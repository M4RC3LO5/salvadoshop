"use client"

import { useState } from "react"
import Image from "next/image"
import { PopupCompraTipoA } from "./PopupCompraTipoA"

export interface ProdutoTipoA {
  id: string
  slug: string
  nome: string
  estado: "Novo" | "Bom" | "Regular" | "A restaurar"
  precoML: number
  urlML?: string
  imagemUrl?: string
  imagemAlt?: string
}

interface CardProdutoTipoAProps {
  produto: ProdutoTipoA
}

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const COR_ESTADO: Record<ProdutoTipoA["estado"], string> = {
  "Novo":        "bg-green-100 text-green-700",
  "Bom":         "bg-blue-100 text-blue-700",
  "Regular":     "bg-ambar-100 text-ambar-700",
  "A restaurar": "bg-marrom-100 text-marrom-700",
}

export function CardProdutoTipoA({ produto }: CardProdutoTipoAProps) {
  const [popupAberto, setPopupAberto] = useState(false)
  const precoSite = produto.precoML * 0.82

  return (
    <>
      <article className="flex flex-col bg-white border border-marrom-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">

        {/* Imagem */}
        <div className="relative w-full aspect-square bg-zinc-100">
          {produto.imagemUrl ? (
            <Image
              src={produto.imagemUrl}
              alt={produto.imagemAlt ?? produto.nome}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}

          {/* Badge Tipo A */}
          <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider bg-marrom-700 text-white px-2 py-0.5 rounded-full">
            Tipo A
          </span>
        </div>

        {/* Conteúdo */}
        <div className="flex flex-col gap-3 p-4 flex-1">

          {/* Nome + estado */}
          <div className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold text-marrom-800 leading-snug line-clamp-2">
              {produto.nome}
            </h2>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full w-fit ${COR_ESTADO[produto.estado]}`}>
              {produto.estado}
            </span>
          </div>

          {/* Preços */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 line-through">
                {formatarPreco(produto.precoML)} no ML
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-700">
                {formatarPreco(precoSite)}
              </span>
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                -18%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">no site</p>
          </div>

          {/* Botão */}
          <button
            type="button"
            onClick={() => setPopupAberto(true)}
            className="mt-auto w-full bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            aria-label={`Comprar ${produto.nome}`}
          >
            Comprar
          </button>
        </div>
      </article>

      {popupAberto && (
        <PopupCompraTipoA
          produto={produto}
          onFechar={() => setPopupAberto(false)}
        />
      )}
    </>
  )
}
