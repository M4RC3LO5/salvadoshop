"use client"

import { useState } from "react"
import { useCarrinho } from "@/contexts/CarrinhoContext"

// ─── CPF helpers ─────────────────────────────────────────────────────────────

function mascaraCpf(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function validarCpf(valor: string): boolean {
  const d = valor.replace(/\D/g, "")
  if (d.length !== 11) return false
  // Rejeita sequências repetidas
  if (/^(\d)\1{10}$/.test(d)) return false

  const calc = (fator: number) => {
    let soma = 0
    for (let i = 0; i < fator - 1; i++) soma += parseInt(d[i]) * (fator - i)
    const resto = (soma * 10) % 11
    return resto >= 10 ? 0 : resto
  }
  return calc(10) === parseInt(d[9]) && calc(11) === parseInt(d[10])
}

// ─── Cartão helpers ──────────────────────────────────────────────────────────

function mascaraCartao(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 16)
  return d.replace(/(.{4})/g, "$1 ").trim()
}

function mascaraValidade(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// ─── CEP helpers ─────────────────────────────────────────────────────────────

function mascaraCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// ─── Classes de input ────────────────────────────────────────────────────────

const inputBase = "text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ambar-400 w-full"
const inputNormal = `${inputBase} border-zinc-200`
const inputErro = `${inputBase} border-red-400 focus:ring-red-400`

// ─── Componente ──────────────────────────────────────────────────────────────

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function PaginaCheckout() {
  const { itens, subtotal } = useCarrinho()
  // Dados pessoais
  const [nome, setNome] = useState("")
  const [cpf, setCpf] = useState("")
  const [cpfTocado, setCpfTocado] = useState(false)
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")

  // Endereço
  // Pagamento
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | null>(null)
  const [numeroCartao, setNumeroCartao] = useState("")
  const [nomeCartao, setNomeCartao] = useState("")
  const [validade, setValidade] = useState("")
  const [cvv, setCvv] = useState("")
  const [parcelas, setParcelas] = useState("1")

  const [cepEndereco, setCepEndereco] = useState("")
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState("")
  const [rua, setRua] = useState("")
  const [numero, setNumero] = useState("")
  const [complemento, setComplemento] = useState("")
  const [bairro, setBairro] = useState("")
  const [cidade, setCidade] = useState("")
  const [uf, setUf] = useState("")

  // CPF
  const cpfDigitos = cpf.replace(/\D/g, "")
  const cpfCompleto = cpfDigitos.length === 11
  const cpfValido = cpfCompleto && validarCpf(cpf)
  const mostrarErroCpf = cpfTocado && cpfCompleto && !cpfValido

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(mascaraCpf(e.target.value))
  }

  // CEP com busca automática ao completar 8 dígitos
  async function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const mascarado = mascaraCep(e.target.value)
    setCepEndereco(mascarado)
    setErroCep("")

    const digits = mascarado.replace(/\D/g, "")
    if (digits.length !== 8) return

    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error("Resposta inválida")
      const dados = await res.json() as {
        erro?: boolean
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }
      if (dados.erro) {
        setErroCep("CEP não encontrado. Verifique o número.")
      } else {
        setRua(dados.logradouro ?? "")
        setBairro(dados.bairro ?? "")
        setCidade(dados.localidade ?? "")
        setUf(dados.uf ?? "")
      }
    } catch {
      setErroCep("Não foi possível buscar o CEP. Tente novamente.")
    } finally {
      setBuscandoCep(false)
    }
  }

  return (
    <div className="container py-8 px-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-marrom-800 mb-6">Finalizar Compra</h1>

      <div className="flex flex-col gap-4">

        {/* ── Dados Pessoais ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-marrom-800">Dados Pessoais</h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-xs font-medium text-zinc-600">Nome completo</label>
            <input
              id="nome"
              type="text"
              placeholder="João da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              className={inputNormal}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpf" className="text-xs font-medium text-zinc-600">CPF</label>
            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              onBlur={() => setCpfTocado(true)}
              maxLength={14}
              autoComplete="off"
              aria-invalid={mostrarErroCpf}
              aria-describedby={mostrarErroCpf ? "cpf-erro" : undefined}
              className={mostrarErroCpf ? inputErro : inputNormal}
            />
            {mostrarErroCpf && (
              <p id="cpf-erro" role="alert" className="text-[11px] text-red-600 font-medium">
                CPF inválido. Verifique os dígitos.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-zinc-600">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputNormal}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="telefone" className="text-xs font-medium text-zinc-600">Telefone</label>
            <input
              id="telefone"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              maxLength={15}
              autoComplete="tel"
              className={inputNormal}
            />
          </div>
        </section>

        {/* ── Endereço de Entrega ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-marrom-800">Endereço de Entrega</h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cep-endereco" className="text-xs font-medium text-zinc-600">CEP</label>
            <div className="relative">
              <input
                id="cep-endereco"
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                value={cepEndereco}
                onChange={handleCepChange}
                maxLength={9}
                autoComplete="postal-code"
                disabled={buscandoCep}
                aria-invalid={!!erroCep}
                aria-describedby={erroCep ? "cep-erro" : undefined}
                className={`${erroCep ? inputErro : inputNormal} pr-9 disabled:bg-zinc-50`}
              />
              {buscandoCep && (
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ambar-500"
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
            </div>
            {erroCep && (
              <p id="cep-erro" role="alert" className="text-[11px] text-red-600 font-medium">
                {erroCep}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rua" className="text-xs font-medium text-zinc-600">Rua</label>
            <input
              id="rua"
              type="text"
              placeholder="Rua das Flores"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              autoComplete="address-line1"
              className={inputNormal}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 w-28 shrink-0">
              <label htmlFor="numero" className="text-xs font-medium text-zinc-600">Número</label>
              <input
                id="numero"
                type="text"
                inputMode="numeric"
                placeholder="42"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                autoComplete="address-line2"
                className={inputNormal}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label htmlFor="complemento" className="text-xs font-medium text-zinc-600">Complemento</label>
              <input
                id="complemento"
                type="text"
                placeholder="Apto 3 (opcional)"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                autoComplete="address-line3"
                className={inputNormal}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bairro" className="text-xs font-medium text-zinc-600">Bairro</label>
            <input
              id="bairro"
              type="text"
              placeholder="Centro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className={inputNormal}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label htmlFor="cidade" className="text-xs font-medium text-zinc-600">Cidade</label>
              <input
                id="cidade"
                type="text"
                placeholder="São Paulo"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                autoComplete="address-level2"
                className={inputNormal}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-20 shrink-0">
              <label htmlFor="uf" className="text-xs font-medium text-zinc-600">Estado</label>
              <input
                id="uf"
                type="text"
                placeholder="SP"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                autoComplete="address-level1"
                className={`${inputNormal} uppercase`}
              />
            </div>
          </div>
        </section>

        {/* ── Forma de Pagamento ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-marrom-800">Forma de Pagamento</h2>

          {/* Toggle Pix / Cartão */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMetodoPagamento("pix")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                metodoPagamento === "pix"
                  ? "border-ambar-500 bg-ambar-50 text-ambar-700"
                  : "border-zinc-200 text-zinc-600 hover:border-ambar-300"
              }`}
              aria-pressed={metodoPagamento === "pix"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Pix
            </button>

            <button
              type="button"
              onClick={() => setMetodoPagamento("cartao")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                metodoPagamento === "cartao"
                  ? "border-marrom-600 bg-marrom-50 text-marrom-700"
                  : "border-zinc-200 text-zinc-600 hover:border-marrom-300"
              }`}
              aria-pressed={metodoPagamento === "cartao"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Cartão de Crédito
            </button>
          </div>

          {/* Pix */}
          {metodoPagamento === "pix" && (
            <div className="flex items-start gap-3 bg-ambar-50 border border-ambar-200 rounded-xl p-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ambar-600 shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-ambar-800 font-medium">
                O QR Code será gerado após confirmar o pedido.
              </p>
            </div>
          )}

          {/* Cartão de Crédito */}
          {metodoPagamento === "cartao" && (
            <div className="flex flex-col gap-4">

              <div className="flex flex-col gap-1.5">
                <label htmlFor="numero-cartao" className="text-xs font-medium text-zinc-600">Número do cartão</label>
                <input
                  id="numero-cartao"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={numeroCartao}
                  onChange={(e) => setNumeroCartao(mascaraCartao(e.target.value))}
                  maxLength={19}
                  autoComplete="cc-number"
                  className={inputNormal}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="nome-cartao" className="text-xs font-medium text-zinc-600">Nome no cartão</label>
                <input
                  id="nome-cartao"
                  type="text"
                  placeholder="JOÃO DA SILVA"
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value.toUpperCase())}
                  autoComplete="cc-name"
                  className={`${inputNormal} uppercase`}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label htmlFor="validade" className="text-xs font-medium text-zinc-600">Validade</label>
                  <input
                    id="validade"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={validade}
                    onChange={(e) => setValidade(mascaraValidade(e.target.value))}
                    maxLength={5}
                    autoComplete="cc-exp"
                    className={inputNormal}
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-24 shrink-0">
                  <label htmlFor="cvv" className="text-xs font-medium text-zinc-600">CVV</label>
                  <input
                    id="cvv"
                    type="text"
                    inputMode="numeric"
                    placeholder="000"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    autoComplete="cc-csc"
                    className={inputNormal}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="parcelas" className="text-xs font-medium text-zinc-600">Parcelas</label>
                <select
                  id="parcelas"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className={inputNormal}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}× sem juros
                    </option>
                  ))}
                </select>
              </div>

            </div>
          )}
        </section>

        {/* ── Resumo do Pedido ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-marrom-800">Resumo do Pedido</h2>

          {itens.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum item no carrinho.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {itens.map((item) => (
                <li key={item.produto_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-700 flex-1 line-clamp-1">{item.nome}</span>
                  <span className="text-zinc-400 shrink-0">× {item.quantidade}</span>
                  <span className="text-zinc-800 font-medium shrink-0">
                    {formatarPreco(item.preco_site * item.quantidade)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <hr className="border-zinc-100" />

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal</span>
              <span>{formatarPreco(subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Frete</span>
              <span>A calcular</span>
            </div>
          </div>

          <hr className="border-zinc-100" />

          <div className="flex justify-between items-center font-bold text-marrom-800">
            <span>Total</span>
            <span className="text-lg">{formatarPreco(subtotal)}</span>
          </div>
        </section>

      </div>

      {/* Rodapé */}
      <div className="mt-6">
        <button
          disabled
          className="w-full bg-green-600 text-white text-sm font-bold py-3.5 rounded-xl opacity-40 cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
