import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Cliente com service role — bypassa RLS para escrita interna do webhook
function criarSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

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
    const orderId = session.metadata?.orderId

    console.log(JSON.stringify({
      event: 'webhook.stripe.checkout_session_completed',
      sessionId: session.id,
      orderId: orderId ?? null,
      valor: session.amount_total,
      statusPagamento: session.payment_status,
      timestamp: new Date().toISOString(),
    }))

    if (!orderId) {
      console.error(JSON.stringify({
        event: 'webhook.stripe.orderId_ausente',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      }))
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const supabase = criarSupabaseAdmin()

    // O pedido já foi criado (com estoque decrementado) antes do checkout —
    // aqui apenas confirmamos o pagamento. Filtra por status atual para
    // ficar idempotente em reentregas do mesmo evento pelo Stripe.
    const { data: pedidoAtualizado, error: erroPedido } = await supabase
      .from('pedidos')
      .update({
        status: 'pago',
        stripe_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
      })
      .eq('id', orderId)
      .eq('status', 'aguardando_pagamento')
      .select('id')
      .maybeSingle()

    if (erroPedido) {
      console.error(JSON.stringify({
        event: 'webhook.stripe.erro_atualizar_pedido',
        orderId,
        error: erroPedido.message,
        timestamp: new Date().toISOString(),
      }))
    } else if (!pedidoAtualizado) {
      console.log(JSON.stringify({
        event: 'webhook.stripe.pedido_ja_processado_ou_nao_encontrado',
        orderId,
        timestamp: new Date().toISOString(),
      }))
    } else {
      console.log(JSON.stringify({
        event: 'webhook.stripe.pedido_pago',
        orderId,
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    console.log(JSON.stringify({
      event: 'webhook.stripe.checkout_session_expired',
      sessionId: session.id,
      orderId: orderId ?? null,
      timestamp: new Date().toISOString(),
    }))

    if (!orderId) {
      console.error(JSON.stringify({
        event: 'webhook.stripe.orderId_ausente',
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      }))
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const supabase = criarSupabaseAdmin()

    // Estorna o estoque e cancela o pedido, mas SOMENTE se ele ainda estiver
    // em aguardando_pagamento — a idempotência e a proteção contra corrida com
    // um pagamento tardio moram dentro da própria RPC (UPDATE condicional).
    const { error: erroEstorno } = await supabase.rpc('estornar_pedido_estoque', {
      p_pedido_id: orderId,
    })

    if (erroEstorno) {
      console.error(JSON.stringify({
        event: 'webhook.stripe.erro_estornar_estoque',
        orderId,
        error: erroEstorno.message,
        timestamp: new Date().toISOString(),
      }))
    } else {
      console.log(JSON.stringify({
        event: 'webhook.stripe.estoque_estornado',
        orderId,
        sessionId: session.id,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
