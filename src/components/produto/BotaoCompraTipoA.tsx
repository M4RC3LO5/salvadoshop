"use client"

import { useState } from "react"
import { PopupCompraTipoA } from "./PopupCompraTipoA"
import type { ProdutoTipoA } from "./CardProdutoTipoA"

interface BotaoCompraTipoAProps {
  produto: ProdutoTipoA
}

export function BotaoCompraTipoA({ produto }: BotaoCompraTipoAProps) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center justify-center gap-2 bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base w-full sm:w-auto"
        aria-label={`Comprar ${produto.nome}`}
      >
        Comprar
      </button>

      {aberto && (
        <PopupCompraTipoA produto={produto} onFechar={() => setAberto(false)} />
      )}
    </>
  )
}
