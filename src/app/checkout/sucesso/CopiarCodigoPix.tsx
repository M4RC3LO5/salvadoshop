"use client"

import { useState } from "react"

interface Props {
  codigo: string
}

export function CopiarCodigoPix({ codigo }: Props) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      const el = document.createElement("textarea")
      el.value = codigo
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div className="flex gap-2 items-stretch">
      <div
        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 font-mono break-all select-all min-h-[44px] flex items-center"
        aria-label="Código Pix copia e cola"
        role="textbox"
        aria-readonly="true"
      >
        {codigo}
      </div>

      <button
        type="button"
        onClick={copiar}
        aria-label={copiado ? "Código copiado" : "Copiar código Pix"}
        className={`shrink-0 px-4 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ambar-400 ${
          copiado
            ? "bg-green-600 text-white"
            : "bg-ambar-500 hover:bg-ambar-600 text-white"
        }`}
      >
        {copiado ? "Copiado!" : "Copiar"}
      </button>
    </div>
  )
}
