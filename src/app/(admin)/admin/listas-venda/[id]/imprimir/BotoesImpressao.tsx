"use client"

import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

export function BotoesImpressao({ voltarHref }: { voltarHref: string }) {
  return (
    <>
      <Link href={voltarHref} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a edição
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-stone-500 sm:inline">Para gerar PDF, escolha “Salvar como PDF” na impressora.</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800"
        >
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / Salvar PDF
        </button>
      </div>
    </>
  )
}
