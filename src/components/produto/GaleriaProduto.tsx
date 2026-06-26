"use client"

import { useState } from "react"
import Image from "next/image"

interface GaleriaProdutoProps {
  imagens: string[]
  nomeProduto: string
}

export function GaleriaProduto({ imagens, nomeProduto }: GaleriaProdutoProps) {
  const [ativa, setAtiva] = useState(0)

  if (imagens.length === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-300">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-label="Sem imagem disponível">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Foto principal */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-100">
        <Image
          src={imagens[ativa]}
          alt={`${nomeProduto} — foto ${ativa + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Miniaturas */}
      {imagens.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Miniaturas de imagem">
          {imagens.map((url, i) => (
            <button
              key={url}
              onClick={() => setAtiva(i)}
              role="listitem"
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === ativa ? "true" : undefined}
              className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                i === ativa ? "border-marrom-700" : "border-zinc-200 hover:border-marrom-300"
              }`}
            >
              <Image
                src={url}
                alt={`Miniatura ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
