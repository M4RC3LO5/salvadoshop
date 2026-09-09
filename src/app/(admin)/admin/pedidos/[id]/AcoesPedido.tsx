"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, X } from "lucide-react"

interface Props {
  pedidoId: string
  statusAtual: string
  role: "master" | "auxiliar"
  codigoRastreio: string | null
  transportadora: string | null
  urlRastreamento: string | null
  cepEntrega: string | null
  itensParaFrete: { quantidade: number }[]
}

interface OpcaoFreteSugerida {
  servico: string
  prazo: string
  preco: number
}

interface Transicao {
  novoStatus: string
  label: string
  estilo: "primaria" | "destrutiva"
}

// Espelha as regras do trigger validar_transicao_status_pedido (migration 008)
const proximoOperacional: Record<string, { novoStatus: string; label: string }> = {
  pago:         { novoStatus: "em_separacao", label: "Marcar em separação" },
  em_separacao: { novoStatus: "enviado", label: "Marcar como enviado" },
  enviado:      { novoStatus: "entregue", label: "Marcar como entregue" },
}

// Confirmação manual de pagamento (Pix por chave fixa / cartão via link
// enviado por WhatsApp) — sem integração automática, só o Master confirma,
// depois de checar o extrato ou o comprovante recebido.
const CONFIRMAR_PAGAMENTO: Transicao = {
  novoStatus: "pago",
  label: "Confirmar pagamento",
  estilo: "primaria",
}

// O pedido nasce sem frete definido — só o Master cota (o total, gerado a
// partir de subtotal + frete, só existe de verdade depois disso).
const COTAR_FRETE: Transicao = {
  novoStatus: "aguardando_pagamento",
  label: "Cotar frete",
  estilo: "primaria",
}

function getTransicoesDisponiveis(statusAtual: string, role: "master" | "auxiliar"): Transicao[] {
  const transicoes: Transicao[] = []

  if (statusAtual === "aguardando_cotacao_frete" && role === "master") {
    transicoes.push(COTAR_FRETE)
  }

  if (statusAtual === "aguardando_pagamento" && role === "master") {
    transicoes.push(CONFIRMAR_PAGAMENTO)
  }

  const operacional = proximoOperacional[statusAtual]
  if (operacional) {
    transicoes.push({ novoStatus: operacional.novoStatus, label: operacional.label, estilo: "primaria" })
  }

  if (role === "master") {
    if (!["cancelado", "reembolsado", "entregue"].includes(statusAtual)) {
      transicoes.push({ novoStatus: "cancelado", label: "Cancelar pedido", estilo: "destrutiva" })
    }
    if (["pago", "em_separacao", "enviado", "entregue"].includes(statusAtual)) {
      transicoes.push({ novoStatus: "reembolsado", label: "Marcar como reembolsado", estilo: "destrutiva" })
    }
  }

  return transicoes
}

export function AcoesPedido({
  pedidoId,
  statusAtual,
  role,
  codigoRastreio,
  transportadora,
  urlRastreamento,
  cepEntrega,
  itensParaFrete,
}: Props) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [statusEmAndamento, setStatusEmAndamento] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarFormEnvio, setMostrarFormEnvio] = useState(false)
  const [mostrarConfirmarPagamento, setMostrarConfirmarPagamento] = useState(false)
  const [mostrarFormFrete, setMostrarFormFrete] = useState(false)

  const [transportadoraInput, setTransportadoraInput] = useState(transportadora ?? "")
  const [codigoRastreioInput, setCodigoRastreioInput] = useState(codigoRastreio ?? "")
  const [urlRastreamentoInput, setUrlRastreamentoInput] = useState(urlRastreamento ?? "")

  const [sugestoesFrete, setSugestoesFrete] = useState<OpcaoFreteSugerida[]>([])
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [erroSugestoes, setErroSugestoes] = useState<string | null>(null)
  const [modalidadeFreteInput, setModalidadeFreteInput] = useState("")
  const [valorFreteInput, setValorFreteInput] = useState("")

  const transicoes = getTransicoesDisponiveis(statusAtual, role)

  async function atualizarStatus(novoStatus: string, camposExtras?: Record<string, unknown>) {
    setSalvando(true)
    setStatusEmAndamento(novoStatus)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, ...camposExtras }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao atualizar o pedido.")
        return false
      }
      router.refresh()
      return true
    } catch {
      setErro("Erro de conexão. Tente novamente.")
      return false
    } finally {
      setSalvando(false)
      setStatusEmAndamento(null)
    }
  }

  async function buscarSugestoesFrete() {
    if (!cepEntrega) {
      setErroSugestoes("Pedido sem CEP de entrega cadastrado — informe o frete manualmente.")
      return
    }
    setCarregandoSugestoes(true)
    setErroSugestoes(null)
    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep_destino: cepEntrega.replace(/\D/g, ""),
          itens: itensParaFrete,
        }),
      })
      const json = await res.json() as { success: boolean; data?: { opcoes: OpcaoFreteSugerida[] }; error?: { message: string } }
      if (!json.success || !json.data) {
        setErroSugestoes(json.error?.message ?? "Não foi possível sugerir o frete. Informe manualmente.")
        return
      }
      setSugestoesFrete(json.data.opcoes)
    } catch {
      setErroSugestoes("Erro de conexão ao buscar sugestão de frete. Informe manualmente.")
    } finally {
      setCarregandoSugestoes(false)
    }
  }

  function handleClickTransicao(transicao: Transicao) {
    if (transicao.novoStatus === "enviado") {
      setMostrarFormEnvio(true)
      return
    }
    if (transicao.novoStatus === "pago" && statusAtual === "aguardando_pagamento") {
      setMostrarConfirmarPagamento(true)
      return
    }
    if (transicao.novoStatus === "aguardando_pagamento" && statusAtual === "aguardando_cotacao_frete") {
      setMostrarFormFrete(true)
      buscarSugestoesFrete()
      return
    }
    atualizarStatus(transicao.novoStatus)
  }

  async function handleConfirmarPagamento() {
    const sucesso = await atualizarStatus("pago")
    if (sucesso) setMostrarConfirmarPagamento(false)
  }

  function handleEscolherSugestaoFrete(opcao: OpcaoFreteSugerida) {
    setModalidadeFreteInput(opcao.servico)
    setValorFreteInput(String(opcao.preco))
  }

  async function handleSubmitFrete() {
    const valorNumerico = Number(valorFreteInput.replace(",", "."))
    if (!modalidadeFreteInput.trim() || isNaN(valorNumerico) || valorNumerico < 0) {
      setErro("Escolha uma modalidade e informe um valor de frete válido.")
      return
    }
    const sucesso = await atualizarStatus("aguardando_pagamento", {
      frete_valor: valorNumerico,
      frete_modalidade: modalidadeFreteInput.trim(),
    })
    if (sucesso) setMostrarFormFrete(false)
  }

  async function handleSubmitEnvio() {
    if (!transportadoraInput.trim() || !codigoRastreioInput.trim()) {
      setErro("Transportadora e código de rastreio são obrigatórios.")
      return
    }
    const sucesso = await atualizarStatus("enviado", {
      transportadora: transportadoraInput.trim(),
      codigo_rastreio: codigoRastreioInput.trim(),
      ...(urlRastreamentoInput.trim() ? { url_rastreamento: urlRastreamentoInput.trim() } : {}),
    })
    if (sucesso) setMostrarFormEnvio(false)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Alerta de erro */}
      {erro && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {erro}
          <button onClick={() => setErro(null)} className="ml-auto text-red-500 hover:text-red-700" aria-label="Fechar erro">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmação inline de pagamento manual */}
      {mostrarConfirmarPagamento && (
        <div role="alertdialog" aria-label="Confirmar pagamento" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-stone-700">
            Confirma que o pagamento deste pedido foi recebido (Pix no extrato ou cartão confirmado)? Essa ação não pode ser desfeita por aqui.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmarPagamento}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Confirmando...</> : "Sim, confirmar pagamento"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarConfirmarPagamento(false)}
              disabled={salvando}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulário inline de cotação de frete */}
      {mostrarFormFrete && (
        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          {carregandoSugestoes && (
            <p className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando sugestão de frete...
            </p>
          )}

          {erroSugestoes && (
            <p className="text-sm text-amber-700">{erroSugestoes}</p>
          )}

          {sugestoesFrete.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-stone-600">Sugestões (clique para usar)</p>
              <div className="flex flex-wrap gap-2">
                {sugestoesFrete.map((opcao) => (
                  <button
                    key={opcao.servico}
                    type="button"
                    onClick={() => handleEscolherSugestaoFrete(opcao)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      modalidadeFreteInput === opcao.servico
                        ? "border-amber-700 bg-amber-100"
                        : "border-stone-300 bg-white hover:bg-stone-100"
                    }`}
                  >
                    <span className="block font-semibold text-stone-700">{opcao.servico}</span>
                    <span className="block text-stone-500">{opcao.prazo}</span>
                    <span className="block font-medium text-stone-800">
                      {opcao.preco === 0 ? "Grátis" : opcao.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="modalidade-frete" className="text-xs font-medium text-stone-600">Modalidade</label>
            <input
              id="modalidade-frete"
              type="text"
              value={modalidadeFreteInput}
              onChange={(e) => setModalidadeFreteInput(e.target.value)}
              placeholder="PAC, SEDEX, Retirar na loja..."
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="valor-frete" className="text-xs font-medium text-stone-600">Valor do frete (R$)</label>
            <input
              id="valor-frete"
              type="text"
              inputMode="decimal"
              value={valorFreteInput}
              onChange={(e) => setValorFreteInput(e.target.value)}
              placeholder="0,00"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
            <p className="text-[11px] text-stone-400">
              O total final é arredondado para cima para terminar nos dois últimos dígitos do número do pedido — a diferença fica embutida no frete.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitFrete}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando...</> : "Confirmar cotação"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormFrete(false)}
              disabled={salvando}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulário inline de envio */}
      {mostrarFormEnvio && (
        <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transportadora" className="text-xs font-medium text-stone-600">Transportadora</label>
            <input
              id="transportadora"
              type="text"
              value={transportadoraInput}
              onChange={(e) => setTransportadoraInput(e.target.value)}
              placeholder="Correios, Jadlog..."
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="codigo-rastreio" className="text-xs font-medium text-stone-600">Código de rastreio</label>
            <input
              id="codigo-rastreio"
              type="text"
              value={codigoRastreioInput}
              onChange={(e) => setCodigoRastreioInput(e.target.value)}
              placeholder="BR1234567890"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="url-rastreamento" className="text-xs font-medium text-stone-600">URL de rastreamento (opcional)</label>
            <input
              id="url-rastreamento"
              type="text"
              value={urlRastreamentoInput}
              onChange={(e) => setUrlRastreamentoInput(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitEnvio}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando...</> : "Confirmar envio"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormEnvio(false)}
              disabled={salvando}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botões de transição */}
      {!mostrarFormEnvio && !mostrarConfirmarPagamento && !mostrarFormFrete && (
        transicoes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {transicoes.map((t) => (
              <button
                key={t.novoStatus}
                type="button"
                onClick={() => handleClickTransicao(t)}
                disabled={salvando}
                className={
                  t.estilo === "primaria"
                    ? "inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    : "inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {statusEmAndamento === t.novoStatus && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {statusEmAndamento === t.novoStatus ? "Salvando..." : t.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">Nenhuma ação disponível para este status.</p>
        )
      )}
    </div>
  )
}
