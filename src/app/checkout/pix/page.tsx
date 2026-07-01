"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"

type StatusPagamento = 'pending' | 'approved' | 'rejected'

function PaginaPix() {
  const params = useSearchParams()
  const router = useRouter()

  const orderId = params.get("orderId") ?? ""
  const pixCode = params.get("pixCode") ?? ""
  const pixQrCodeBase64 = params.get("pixQrCodeBase64") ?? ""
  const paymentId = params.get("paymentId") ?? ""

  const [copiado, setCopiado] = useState(false)
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>("pending")

  useEffect(() => {
    if (!paymentId) return

    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/pix/status?paymentId=${paymentId}`)
        if (!res.ok) return
        const json = await res.json() as { success: boolean; data?: { status: StatusPagamento } }
        if (!json.success || !json.data) return

        const { status } = json.data
        setStatusPagamento(status)

        if (status === 'approved') {
          clearInterval(intervalo)
          router.push(`/pedido/${orderId}`)
        } else if (status === 'rejected') {
          clearInterval(intervalo)
        }
      } catch {
        // falha silenciosa — tenta de novo no próximo tick
      }
    }, 5000)

    return () => clearInterval(intervalo)
  }, [paymentId, orderId, router])

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(pixCode)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      const el = document.createElement("textarea")
      el.value = pixCode
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div className="container py-8 px-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-marrom-800 mb-1">Pagar com Pix</h1>
      {orderId && (
        <p className="text-xs text-zinc-400 mb-6">Pedido #{orderId}</p>
      )}

      <div className="flex flex-col gap-4">

        {/* ── Aviso de expiração ── */}
        <div className="flex items-center gap-3 bg-ambar-50 border border-ambar-200 rounded-xl px-4 py-3">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-ambar-600 shrink-0" aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-sm text-ambar-800 font-medium">
            O QR Code expira em <strong>30 minutos</strong>
          </p>
        </div>

        {/* ── QR Code ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col items-center gap-4">
          <h2 className="text-base font-bold text-marrom-800 self-start">QR Code</h2>

          {pixQrCodeBase64 ? (
            <div className="border border-zinc-100 rounded-xl p-3 bg-white">
              <Image
                src={`data:image/png;base64,${pixQrCodeBase64}`}
                alt="QR Code Pix para pagamento"
                width={220}
                height={220}
                priority
                unoptimized
              />
            </div>
          ) : (
            <div
              className="w-[220px] h-[220px] bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 text-sm"
              aria-label="QR Code indisponível"
            >
              QR Code indisponível
            </div>
          )}

          <p className="text-xs text-zinc-400 text-center">
            Aponte a câmera do celular para o QR Code acima
          </p>
        </section>

        {/* ── Código copia e cola ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="text-base font-bold text-marrom-800">Pix Copia e Cola</h2>

          <div className="flex gap-2 items-stretch">
            <div
              className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-600 font-mono break-all select-all min-h-[44px] flex items-center"
              aria-label="Código Pix copia e cola"
              role="textbox"
              aria-readonly="true"
            >
              {pixCode || "—"}
            </div>

            <button
              type="button"
              onClick={copiarCodigo}
              disabled={!pixCode}
              aria-label={copiado ? "Código copiado" : "Copiar código Pix"}
              className={`shrink-0 px-4 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ambar-400 disabled:opacity-40 disabled:cursor-not-allowed ${
                copiado
                  ? "bg-green-600 text-white"
                  : "bg-ambar-500 hover:bg-ambar-600 text-white"
              }`}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </section>

        {/* ── Instruções passo a passo ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <h2 className="text-base font-bold text-marrom-800">Como pagar</h2>

          <ol className="flex flex-col gap-3" aria-label="Passos para pagar com Pix">
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full bg-ambar-100 text-ambar-700 text-sm font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                1
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-zinc-800">Abra o app do seu banco</p>
                <p className="text-xs text-zinc-500 mt-0.5">Qualquer banco com Pix habilitado</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full bg-ambar-100 text-ambar-700 text-sm font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                2
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-zinc-800">Acesse a área Pix</p>
                <p className="text-xs text-zinc-500 mt-0.5">Escolha &quot;Pagar&quot; ou &quot;Ler QR Code&quot;</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full bg-ambar-100 text-ambar-700 text-sm font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                3
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-zinc-800">Escaneie o QR Code ou cole o código</p>
                <p className="text-xs text-zinc-500 mt-0.5">Confirme o valor e finalize o pagamento</p>
              </div>
            </li>
          </ol>
        </section>

        {/* ── Status do pagamento ── */}
        {statusPagamento === 'pending' && (
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-zinc-400 shrink-0 animate-spin" aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p className="text-sm text-zinc-500">Aguardando pagamento…</p>
          </div>
        )}

        {statusPagamento === 'approved' && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3" role="status">
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-green-600 shrink-0" aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm text-green-700 font-semibold">Pagamento confirmado! Redirecionando…</p>
          </div>
        )}

        {statusPagamento === 'rejected' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-red-500 shrink-0 mt-0.5" aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div>
              <p className="text-sm text-red-700 font-semibold">Pagamento recusado</p>
              <p className="text-xs text-red-500 mt-0.5">
                O pagamento não foi confirmado. Tente gerar um novo QR Code ou escolha outra forma de pagamento.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function PaginaCheckoutPix() {
  return (
    <Suspense>
      <PaginaPix />
    </Suspense>
  )
}
