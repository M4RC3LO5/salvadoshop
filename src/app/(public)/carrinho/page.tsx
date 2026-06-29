"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCarrinho } from "@/contexts/CarrinhoContext"
import type { OpcaoFrete } from "@/app/api/frete/route"

// Dimensões padrão por item (usadas no cálculo de frete)
const PESO_PADRAO = 1       // kg
const ALTURA_PADRAO = 20    // cm
const LARGURA_PADRAO = 20   // cm
const COMPRIMENTO_PADRAO = 20 // cm

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function mascaraCep(valor: string) {
  const v = valor.replace(/\D/g, "").slice(0, 8)
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v
}

export default function PaginaCarrinho() {
  const { itens, subtotal, remover, atualizarQuantidade } = useCarrinho()
  const router = useRouter()

  const [cep, setCep] = useState("")
  const [calculando, setCalculando] = useState(false)
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([])
  const [freteEscolhido, setFreteEscolhido] = useState<OpcaoFrete | null>(null)
  const [erroCep, setErroCep] = useState("")
  const [enderecoLoja, setEnderecoLoja] = useState("")
  const [whatsappLoja, setWhatsappLoja] = useState("")

  const retiradaNaLoja = freteEscolhido?.servico === "Retirar na loja"
  const total = subtotal + (freteEscolhido?.preco ?? 0)

  async function calcularFrete() {
    const cepLimpo = cep.replace(/\D/g, "")
    if (cepLimpo.length !== 8) {
      setErroCep("Digite um CEP válido com 8 dígitos.")
      return
    }

    setErroCep("")
    setCalculando(true)
    setOpcoesFrete([])
    setFreteEscolhido(null)

    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep_destino: cepLimpo,
          itens: itens.map((item) => ({
            peso: PESO_PADRAO,
            altura: ALTURA_PADRAO,
            largura: LARGURA_PADRAO,
            comprimento: COMPRIMENTO_PADRAO,
            quantidade: item.quantidade,
          })),
        }),
      })

      const json = await res.json() as {
        success: boolean
        data?: { opcoes: OpcaoFrete[]; whatsapp: string; endereco_loja: string }
        error?: { message: string }
      }

      if (!json.success || !json.data) {
        setErroCep(json.error?.message ?? "Não foi possível calcular o frete. Tente novamente.")
        return
      }

      setOpcoesFrete(json.data.opcoes)
      setEnderecoLoja(json.data.endereco_loja)
      setWhatsappLoja(json.data.whatsapp)
    } catch {
      setErroCep("Erro de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setCalculando(false)
    }
  }

  if (itens.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-ambar-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ambar-500" aria-hidden="true">
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-marrom-800 mb-2">Seu carrinho está vazio</h1>
          <p className="text-sm text-zinc-500">Explore nossa vitrine e encontre produtos com ótimos preços!</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Voltar à loja
        </Link>
      </div>
    )
  }

  return (
    <div className="container py-8 px-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-marrom-800 mb-6">Meu Carrinho</h1>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Lista de itens ── */}
        <section className="flex-1" aria-label="Itens no carrinho">
          <ul className="flex flex-col gap-4">
            {itens.map((item) => (
              <li key={item.produto_id} className="flex gap-4 bg-white border border-marrom-100 rounded-xl p-4 shadow-sm">
                {/* Imagem */}
                <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                  {item.imagem ? (
                    <Image src={item.imagem} alt={item.nome} fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-marrom-800 leading-snug line-clamp-2">{item.nome}</p>
                  <p className="text-base font-bold text-green-700">{formatarPreco(item.preco_site)}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => item.quantidade === 1 ? remover(item.produto_id) : atualizarQuantidade(item.produto_id, item.quantidade - 1)}
                        aria-label="Diminuir quantidade"
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors text-lg leading-none"
                      >−</button>
                      <span className="w-8 text-center text-sm font-semibold text-zinc-800" aria-label={`Quantidade: ${item.quantidade}`}>
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + 1)}
                        aria-label="Aumentar quantidade"
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors text-lg leading-none"
                      >+</button>
                    </div>
                    <button
                      onClick={() => remover(item.produto_id)}
                      aria-label={`Remover ${item.nome} do carrinho`}
                      className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                {/* Subtotal do item */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-zinc-400 mb-0.5">Total</p>
                  <p className="text-sm font-bold text-marrom-800">{formatarPreco(item.preco_site * item.quantidade)}</p>
                </div>
              </li>
            ))}
          </ul>

          <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-ambar-600 hover:text-ambar-700 font-medium transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Continuar comprando
          </Link>
        </section>

        {/* ── Resumo do pedido ── */}
        <aside className="lg:w-80 shrink-0" aria-label="Resumo do pedido">
          <div className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4 sticky top-4">
            <h2 className="text-base font-bold text-marrom-800">Resumo do pedido</h2>

            {/* Campo CEP — oculto se "Retirar na loja" selecionado */}
            {!retiradaNaLoja && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cep" className="text-xs font-medium text-zinc-600">
                  Calcular frete
                </label>
                <div className="flex gap-2">
                  <input
                    id="cep"
                    type="text"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => {
                      setCep(mascaraCep(e.target.value))
                      setErroCep("")
                    }}
                    onKeyDown={(e) => e.key === "Enter" && calcularFrete()}
                    maxLength={9}
                    disabled={calculando}
                    aria-describedby={erroCep ? "cep-erro" : undefined}
                    aria-invalid={!!erroCep}
                    className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ambar-400 disabled:bg-zinc-50"
                  />
                  <button
                    onClick={calcularFrete}
                    disabled={calculando || cep.replace(/\D/g, "").length !== 8}
                    className="text-sm font-semibold bg-ambar-500 hover:bg-ambar-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white px-3 py-2 rounded-lg transition-colors min-w-[52px] flex items-center justify-center"
                    aria-label="Calcular frete"
                  >
                    {calculando ? (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : "OK"}
                  </button>
                </div>

                {erroCep && (
                  <p id="cep-erro" role="alert" className="text-[11px] text-red-600 font-medium">
                    {erroCep}
                  </p>
                )}
              </div>
            )}

            {/* Opções de frete */}
            {opcoesFrete.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-semibold text-zinc-600 mb-1">Escolha o envio</legend>

                {opcoesFrete.map((opcao) => {
                  const id = `frete-${opcao.servico.replace(/\s+/g, "-").toLowerCase()}`
                  const selecionada = freteEscolhido?.servico === opcao.servico
                  const retirada = opcao.servico === "Retirar na loja"

                  return (
                    <label
                      key={opcao.servico}
                      htmlFor={id}
                      className={`flex flex-col gap-1 border-2 rounded-xl p-3 cursor-pointer transition-colors ${
                        selecionada
                          ? "border-ambar-500 bg-ambar-50"
                          : "border-zinc-200 hover:border-ambar-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={id}
                          name="opcao-frete"
                          value={opcao.servico}
                          checked={selecionada}
                          onChange={() => setFreteEscolhido(opcao)}
                          className="accent-ambar-500"
                        />
                        <div className="flex items-center justify-between flex-1 gap-2">
                          <span className="text-sm font-semibold text-zinc-800">{opcao.servico}</span>
                          <span className={`text-sm font-bold ${retirada ? "text-green-600" : "text-marrom-800"}`}>
                            {opcao.preco === 0 ? "Grátis" : formatarPreco(opcao.preco)}
                          </span>
                        </div>
                      </div>

                      {/* Prazo */}
                      {!retirada && (
                        <p className="text-[11px] text-zinc-500 pl-5">Entrega em {opcao.prazo}</p>
                      )}

                      {/* Endereço da loja quando "Retirar na loja" */}
                      {retirada && selecionada && enderecoLoja && (
                        <div className="pl-5 flex flex-col gap-1 mt-1">
                          <p className="text-[11px] text-zinc-600 font-medium">{enderecoLoja}</p>
                          <a
                            href={`https://wa.me/${whatsappLoja}?text=${encodeURIComponent("Olá! Quero combinar o horário de retirada do meu pedido.")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                          >
                            📱 Combinar horário via WhatsApp
                          </a>
                        </div>
                      )}

                      {/* Endereço da loja quando "Retirar na loja" não selecionada (resumido) */}
                      {retirada && !selecionada && (
                        <p className="text-[11px] text-zinc-500 pl-5">Combinar via WhatsApp</p>
                      )}
                    </label>
                  )
                })}
              </fieldset>
            )}

            {/* Endereço da loja em destaque quando retirada selecionada */}
            {retiradaNaLoja && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-green-700">📍 Endereço para retirada</p>
                <p className="text-sm text-zinc-700">{enderecoLoja}</p>
                <a
                  href={`https://wa.me/${whatsappLoja}?text=${encodeURIComponent("Olá! Quero combinar o horário de retirada do meu pedido.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-700 font-semibold underline underline-offset-2"
                >
                  📱 Combinar horário via WhatsApp
                </a>
                <button
                  onClick={() => {
                    setFreteEscolhido(null)
                    setOpcoesFrete([])
                    setCep("")
                  }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 underline underline-offset-2 text-left mt-1"
                >
                  Calcular frete com CEP
                </button>
              </div>
            )}

            <hr className="border-zinc-100" />

            {/* Valores */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>{formatarPreco(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Frete</span>
                <span>
                  {freteEscolhido
                    ? freteEscolhido.preco === 0
                      ? <span className="text-green-600 font-semibold">Grátis</span>
                      : formatarPreco(freteEscolhido.preco)
                    : <span className="text-zinc-400">A calcular</span>}
                </span>
              </div>
            </div>

            <hr className="border-zinc-100" />

            <div className="flex justify-between items-center font-bold text-marrom-800">
              <span>Total</span>
              <span className="text-lg">{formatarPreco(total)}</span>
            </div>

            <button
              onClick={() => router.push("/checkout")}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-bold py-3.5 rounded-xl transition-colors"
            >
              Finalizar Compra
            </button>

            <p className="text-center text-[11px] text-zinc-400">
              🔒 Pagamento seguro via Stripe e Mercado Pago
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
