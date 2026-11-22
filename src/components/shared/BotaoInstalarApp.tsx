"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"

// Evento do Chrome/Edge/Android que permite abrir o pedido de instalação.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function jaInstalado() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function ehIOS() {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function BotaoInstalarApp({
  className = "",
  rotulo = "Baixar app",
  ajudaAcima = false,
}: {
  className?: string
  rotulo?: string
  ajudaAcima?: boolean
}) {
  const [pedido, setPedido] = useState<BeforeInstallPromptEvent | null>(null)
  const [mostrar, setMostrar] = useState(false)
  const [ajuda, setAjuda] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    if (jaInstalado()) return
    if (ehIOS()) setMostrar(true)

    const aoOferecer = (e: Event) => {
      e.preventDefault()
      setPedido(e as BeforeInstallPromptEvent)
      setMostrar(true)
    }
    const aoInstalar = () => {
      setMostrar(false)
      setPedido(null)
    }
    window.addEventListener("beforeinstallprompt", aoOferecer)
    window.addEventListener("appinstalled", aoInstalar)
    return () => {
      window.removeEventListener("beforeinstallprompt", aoOferecer)
      window.removeEventListener("appinstalled", aoInstalar)
    }
  }, [])

  if (!mostrar) return null

  async function instalar() {
    if (pedido) {
      await pedido.prompt()
      const escolha = await pedido.userChoice
      if (escolha.outcome === "accepted") setMostrar(false)
      setPedido(null)
      return
    }
    setAjuda((v) => !v)
  }

  return (
    <div className="relative">
      <button type="button" onClick={instalar} className={className} aria-expanded={pedido ? undefined : ajuda}>
        <Download size={18} aria-hidden="true" />
        {rotulo}
      </button>
      {ajuda && (
        <p
          role="status"
          className={`absolute z-50 w-64 ${ajudaAcima ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"} rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-800 shadow-lg`}
        >
          No iPhone: toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.
        </p>
      )}
    </div>
  )
}
