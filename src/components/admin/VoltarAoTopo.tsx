"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ArrowUp } from "lucide-react"

const LIMITE_ROLAGEM_PX = 400

// Telas que rolam num container interno (e não na janela) marcam esse container
// com data-rolagem-principal; o botão passa a observar e a rolar esse elemento.
const SELETOR_ROLAGEM_PRINCIPAL = "[data-rolagem-principal]"

function elementoRolagemPrincipal(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELETOR_ROLAGEM_PRINCIPAL)
}

// Botão flutuante "voltar ao topo" do painel admin. Fica no canto inferior
// direito, acima da posição dos avisos (toast) e de qualquer outro botão
// flutuante, e nunca aparece no papel.
export function VoltarAoTopo() {
  const [visivel, setVisivel] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const atualizar = () => {
      const interno = elementoRolagemPrincipal()
      setVisivel(window.scrollY > LIMITE_ROLAGEM_PX || (interno?.scrollTop ?? 0) > LIMITE_ROLAGEM_PX)
    }
    // O componente fica no layout e não remonta ao navegar: recalcula a cada
    // mudança de rota, e de novo no próximo frame porque a tela nova pode
    // montar o [data-rolagem-principal] depois.
    atualizar()
    const frame = requestAnimationFrame(atualizar)
    // capture: true — o evento scroll não borbulha, então é a única forma de
    // ouvir a rolagem de elementos a partir da janela.
    window.addEventListener("scroll", atualizar, { passive: true, capture: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", atualizar, { capture: true })
    }
  }, [pathname])

  function voltar() {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const behavior = reduzir ? "auto" : "smooth"
    const interno = elementoRolagemPrincipal()
    if (interno && interno.scrollTop > 0) {
      interno.scrollTo({ top: 0, behavior })
    } else {
      window.scrollTo({ top: 0, behavior })
    }
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
