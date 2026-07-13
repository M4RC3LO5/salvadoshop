import Link from "next/link"
import Stripe from "stripe"
import { LimpaCarrinhoNoSucesso } from "./LimpaCarrinhoNoSucesso"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

interface PaginaCheckoutSucessoProps {
  searchParams: { session_id?: string }
}

export default async function PaginaCheckoutSucesso({ searchParams }: PaginaCheckoutSucessoProps) {
  const sessionId = searchParams.session_id

  let orderId: string | null = null
  let pago = false

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      orderId = session.metadata?.orderId ?? null
      pago = session.payment_status === "paid"
    } catch (error) {
      console.error(JSON.stringify({
        event: "checkout.sucesso.erro_buscar_sessao",
        sessionId,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      }))
    }
  }

  if (pago) {
    return (
      <div className="container py-8 px-4 max-w-lg mx-auto">
        <LimpaCarrinhoNoSucesso />
        <div className="flex flex-col items-center text-center gap-6 py-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold text-marrom-800 mb-2">Pagamento confirmado!</h1>
            {orderId && (
              <p className="text-xs text-zinc-400 mb-2">Pedido #{orderId}</p>
            )}
            <p className="text-sm text-zinc-500">
              Recebemos seu pagamento e já vamos separar seu pedido. Você receberá um e-mail com os detalhes da compra.
            </p>
          </div>

          <div className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm w-full text-left flex flex-col gap-2">
            <h2 className="text-sm font-bold text-marrom-800">Próximos passos</h2>
            <ul className="text-xs text-zinc-500 flex flex-col gap-1 list-disc pl-4">
              <li>Vamos conferir e separar seu pedido</li>
              <li>Você recebe o código de rastreio por e-mail assim que despachar</li>
              <li>Em caso de dúvidas, fale com a gente pelo WhatsApp</li>
            </ul>
          </div>

          <Link href="/" className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
            Voltar à loja
          </Link>
        </div>
      </div>
    )
  }

  // Estado neutro: sessão sem session_id, pagamento ainda não confirmado pelo
  // Stripe, ou erro ao consultar — nunca afirmamos sucesso sem payment_status "paid"
  return (
    <div className="container py-8 px-4 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 animate-spin" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-marrom-800 mb-2">Confirmando seu pagamento…</h1>
          {orderId && (
            <p className="text-xs text-zinc-400 mb-2">Pedido #{orderId}</p>
          )}
          <p className="text-sm text-zinc-500">
            Ainda não recebemos a confirmação do pagamento. Se você já pagou, aguarde alguns instantes — vamos te avisar por e-mail assim que for confirmado.
          </p>
        </div>

        <Link href="/" className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
          Voltar à loja
        </Link>
      </div>
    </div>
  )
}
