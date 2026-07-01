import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Route Handlers do App Router não fazem parsing automático do body (diferente
// do Pages Router), então request.text() já entrega o payload raw exigido pelo
// stripe.webhooks.constructEvent para validar a assinatura.
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Assinatura ausente' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (error) {
    console.error(JSON.stringify({
      event: 'webhook.stripe.assinatura_invalida',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    console.log(JSON.stringify({
      event: 'webhook.stripe.checkout_session_completed',
      sessionId: session.id,
      orderId: session.metadata?.orderId ?? null,
      valor: session.amount_total,
      statusPagamento: session.payment_status,
      timestamp: new Date().toISOString(),
    }))
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
