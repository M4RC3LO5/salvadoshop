"use client"

import { useState } from "react"
import { PopupCompraTipoA } from "./PopupCompraTipoA"
import { ToastAdicionado } from "./ToastAdicionado"
import { useCompraDireta } from "./useCompraDireta"
import type { ProdutoTipoA } from "./CardProdutoTipoA"

interface BotaoCompraTipoAProps {
  produto: ProdutoTipoA
}

export function BotaoCompraTipoA({ produto }: BotaoCompraTipoAProps) {
  const [aberto, setAberto] = useState(false)
  const { adicionado, comprar } = useCompraDireta(produto)

  return (
    <>
      <button
        onClick={() => (produto.exclusivo ? comprar() : setAberto(true))}
        className="inline-flex items-center justify-center gap-2 bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base w-full sm:w-auto"
        aria-label={`Comprar ${produto.nome}`}
      >
        Comprar
      </button>

      {!produto.exclusivo && aberto && (
        <PopupCompraTipoA produto={produto} onFechar={() => setAberto(false)} />
      )}
      {produto.exclusivo && <ToastAdicionado visivel={adicionado} />}
    </>
  )
}
