"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"

const LIMITE_ROLAGEM_PX = 400

// Botão flutuante "voltar ao topo" do painel admin. Fica no canto inferior
// direito, acima da posição dos avisos (toast) e de qualquer outro botão
// flutuante, e nunca aparece no papel.
export function VoltarAoTopo() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const atualizar = () => setVisivel(window.scrollY > LIMITE_ROLAGEM_PX)
    atualizar()
    window.addEventListener("scroll", atualizar, { passive: true })
    return () => window.removeEventListener("scroll", atualizar)
  }, [])

  function voltar() {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: reduzir ? "auto" : "smooth" })
  }

  if (!visivel) return null

  return (
    <button
      type="button"
      onClick={voltar}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      className="fixed bottom-24 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-stone-800 text-white shadow-lg transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 print:hidden"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
