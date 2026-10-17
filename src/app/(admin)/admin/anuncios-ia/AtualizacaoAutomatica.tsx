"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const INTERVALO_MS = 10_000

// Atualiza a fila sozinha enquanto houver anúncio pendente.
export function AtualizacaoAutomatica({ ativo }: { ativo: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!ativo) return
    const timer = setInterval(() => router.refresh(), INTERVALO_MS)
    return () => clearInterval(timer)
  }, [ativo, router])

  return (
    <p aria-live="polite" className="min-h-[1rem] text-xs text-gray-500">
      {ativo ? "Atualizando automaticamente..." : ""}
    </p>
  )
}
