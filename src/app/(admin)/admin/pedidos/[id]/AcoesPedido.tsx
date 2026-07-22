"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, X } from "lucide-react"

interface Props {
  pedidoId: string
  statusAtual: string
  role: "master" | "auxiliar"
  codigoRastreio: string | null
  transportadora: string | null
  urlRastreamento: string | null
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

function getTransicoesDisponiveis(statusAtual: string, role: "master" | "auxiliar"): Transicao[] {
  const transicoes: Transicao[] = []

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
}: Props) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarFormEnvio, setMostrarFormEnvio] = useState(false)

  const [transportadoraInput, setTransportadoraInput] = useState(transportadora ?? "")
  const [codigoRastreioInput, setCodigoRastreioInput] = useState(codigoRastreio ?? "")
  const [urlRastreamentoInput, setUrlRastreamentoInput] = useState(urlRastreamento ?? "")

  const transicoes = getTransicoesDisponiveis(statusAtual, role)

  async function atualizarStatus(novoStatus: string, camposRastreio?: Record<string, string>) {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, ...camposRastreio }),
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
    }
  }

  function handleClickTransicao(transicao: Transicao) {
    if (transicao.novoStatus === "enviado") {
      setMostrarFormEnvio(true)
      return
    }
    atualizarStatus(transicao.novoStatus)
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
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Confirmar envio"}
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
      {!mostrarFormEnvio && (
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
                    ? "rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
                    : "rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                }
              >
                {t.label}
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
