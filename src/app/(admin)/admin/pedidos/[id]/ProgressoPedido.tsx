import { Check, RotateCcw, XCircle } from "lucide-react"

interface ProgressoPedidoProps {
  status: string
}

const ETAPAS = [
  { chave: "aguardando_pagamento", label: "Aguardando pagamento" },
  { chave: "pago",                 label: "Pago" },
  { chave: "em_separacao",         label: "Em separação" },
  { chave: "enviado",              label: "Enviado" },
  { chave: "entregue",             label: "Entregue" },
]

export function ProgressoPedido({ status }: ProgressoPedidoProps) {
  if (status === "cancelado" || status === "reembolsado") {
    const cancelado = status === "cancelado"
    const Icon = cancelado ? XCircle : RotateCcw
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          cancelado
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-stone-300 bg-stone-50 text-stone-600"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold">
          {cancelado ? "Pedido cancelado" : "Pedido reembolsado"}
        </p>
      </div>
    )
  }

  const indiceEncontrado = ETAPAS.findIndex((etapa) => etapa.chave === status)
  const indiceAtual = indiceEncontrado === -1 ? 0 : indiceEncontrado
  const percentualLinha = (indiceAtual / (ETAPAS.length - 1)) * 100

  return (
    <div className="relative flex items-start justify-between">
      {/* Linha base */}
      <div className="absolute left-0 right-0 top-4 h-0.5 bg-stone-200 sm:top-[18px]" />
      {/* Linha preenchida até o índice atual */}
      <div
        className="absolute left-0 top-4 h-0.5 bg-amber-700 transition-[width] sm:top-[18px]"
        style={{ width: `${percentualLinha}%` }}
      />

      {ETAPAS.map((etapa, i) => {
        const concluida = i < indiceAtual
        const ativa = i === indiceAtual
        const alcancada = i <= indiceAtual

        return (
          <div key={etapa.chave} className="relative z-10 flex flex-1 flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-9 sm:w-9 ${
                alcancada
                  ? "bg-amber-700 text-white"
                  : "bg-stone-200 text-stone-500"
              } ${ativa ? "ring-2 ring-amber-700/30 ring-offset-2 ring-offset-white" : ""}`}
            >
              {concluida ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </div>
            <span
              className={`max-w-[5.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs ${
                alcancada ? "text-stone-800" : "text-stone-400"
              }`}
            >
              {etapa.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
