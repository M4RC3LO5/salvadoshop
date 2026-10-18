"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface Props {
  id: string
  status: "erro" | "convertido"
  temProduto: boolean
  dataRotulo: string
}

const botaoCls =
  "inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"

// Ação extra da linha da fila: remover da fila (erro/convertido).
export function AcoesLinha({ id, status, temProduto, dataRotulo }: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState("")
  const travaRef = useRef(false)

  async function enviar() {
    if (travaRef.current) return
    travaRef.current = true
    setOcupado(true)
    setErro("")
    try {
      const res = await fetch(`/api/admin/anuncios-ia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "descartar" }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json?.error?.message ?? "Não foi possível concluir. Tente novamente.")
        setConfirmando(false)
      } else {
        router.refresh()
      }
    } catch {
      setErro("Não foi possível concluir. Verifique a conexão e tente novamente.")
      setConfirmando(false)
    } finally {
      travaRef.current = false
      setOcupado(false)
    }
  }

  const semProduto = status === "convertido" && !temProduto

  return (
    <div className="flex flex-col items-end gap-1">
      {semProduto && <p className="text-xs text-gray-600">Produto excluído</p>}

      {confirmando ? (
        <div role="group" aria-label={`Confirmar remoção do anúncio de ${dataRotulo}`} className="flex flex-col items-end gap-1">
          <p className="text-xs font-medium text-gray-800">Remover da fila?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={ocupado}
              aria-label={`Remover da fila o anúncio de ${dataRotulo}`}
              className={`${botaoCls} border-red-600 bg-red-600 text-white hover:bg-red-700`}
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Remover
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={ocupado}
              className={`${botaoCls} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={ocupado}
            aria-label={`Remover da fila o anúncio de ${dataRotulo}`}
            className={`${botaoCls} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          >
            Remover da fila
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="max-w-[16rem] text-right text-xs text-red-700">
          {erro}
        </p>
      )}
    </div>
  )
}
