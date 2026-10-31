"use client"

import { useEffect } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

// ── Diálogo de confirmação genérico ─────────────────────────────────────────
// Usado na triagem e na lista de venda. Não use window.confirm: não funciona no
// navegador embutido do app do Claude (devolve "não" e nada acontece).

export function ConfirmDialog({
  titulo, mensagem, confirmarLabel, destrutivo, carregando, onConfirmar, onCancelar,
}: {
  titulo: string
  mensagem: string
  confirmarLabel: string
  destrutivo?: boolean
  carregando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  // Esc cancela (como o clique fora do diálogo)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !carregando) onCancelar()
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [carregando, onCancelar])

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancelar} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", destrutivo ? "bg-red-100" : "bg-amber-100")}>
            <AlertTriangle className={cn("h-5 w-5", destrutivo ? "text-red-600" : "text-amber-700")} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
            <p className="mt-1 text-sm text-stone-500">{mensagem}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancelar} disabled={carregando} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
              destrutivo ? "bg-red-600 hover:bg-red-700" : "bg-amber-700 hover:bg-amber-800"
            )}
          >
            {carregando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Aguarde...</> : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
