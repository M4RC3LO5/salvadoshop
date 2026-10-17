"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export function BotaoProcessar({ id, status }: { id: string; status: "enviado" | "erro" }) {
  const router = useRouter()
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState("")
  const travaRef = useRef(false)

  async function processar() {
    if (travaRef.current) return
    travaRef.current = true
    setProcessando(true)
    setErro("")
    try {
      const res = await fetch(`/api/admin/anuncios-ia/${id}/processar`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json?.error?.message ?? "Não foi possível processar. Tente novamente.")
      }
    } catch {
      setErro("Não foi possível processar. Verifique a conexão e tente novamente.")
    } finally {
      travaRef.current = false
      setProcessando(false)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void processar()}
        disabled={processando}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {processando ? "Processando..." : status === "erro" ? "Tentar de novo" : "Processar"}
      </button>
      {erro && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-red-700">
          {erro}
        </p>
      )}
    </div>
  )
}
