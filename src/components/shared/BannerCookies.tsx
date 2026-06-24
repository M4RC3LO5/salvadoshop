"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const CHAVE_CONSENTIMENTO = "cookie_consent"

export function BannerCookies() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    // Só exibe se ainda não houver consentimento salvo
    const consentimento = localStorage.getItem(CHAVE_CONSENTIMENTO)
    if (!consentimento) setVisivel(true)
  }, [])

  function aceitar(tipo: "all" | "essential") {
    localStorage.setItem(CHAVE_CONSENTIMENTO, tipo)
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 bg-marrom-900 text-white px-4 py-4 shadow-2xl"
    >
      <div className="container flex flex-col sm:flex-row sm:items-center gap-4">

        {/* Texto */}
        <p className="text-sm leading-relaxed flex-1">
          Usamos cookies para melhorar sua experiência. Ao continuar, você concorda com nossa{" "}
          <Link
            href="/privacidade"
            className="text-ambar-400 underline underline-offset-2 hover:text-ambar-300 focus:outline-none focus:ring-2 focus:ring-ambar-400 rounded"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* Botões */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={() => aceitar("essential")}
            aria-label="Aceitar apenas cookies essenciais"
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-white text-white hover:bg-white/10 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          >
            Só essenciais
          </button>
          <button
            type="button"
            onClick={() => aceitar("all")}
            aria-label="Aceitar todos os cookies"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-ambar-400"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}
