import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const itemSchema = z.object({
  produto_id: z.string().min(1),
  nome: z.string().min(1),
  preco_site: z.number().positive(),
  quantidade: z.number().int().positive(),
})

const checkoutSchema = z.object({
  orderId: z.string().min(1),
  itens: z.array(itemSchema).min(1),
  customerEmail: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { orderId, itens, customerEmail } = parsed.data
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = itens.map((item) => ({
      price_data: {
        currency: 'brl',
        product_data: { name: item.nome },
        unit_amount: Math.round(item.preco_site * 100),
      },
      quantity: item.quantidade,
    }))

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      client_reference_id: orderId,
      customer_email: customerEmail,
      success_url: `${appUrl}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/falha`,
      metadata: { orderId },
    })

    if (!session.url) {
      return NextResponse.json(
        { success: false, error: { code: 'PAYMENT_FAILED', message: 'Falha ao gerar sessão de pagamento' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { url: session.url },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'checkout.stripe.error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar pagamento com cartão' } },
      { status: 500 }
    )
  }
}
