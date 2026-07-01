import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const itemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().positive(),
})

const enderecoSchema = z.object({
  cep: z.string().min(8),
  rua: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
})

const checkoutSchema = z.object({
  orderId: z.string().uuid(),
  itens: z.array(itemSchema).min(1),
  enderecoEntrega: enderecoSchema,
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

    const { orderId, itens, enderecoEntrega, customerEmail } = parsed.data
    const supabase = createClient()

    // Checkout de convidado: garante uma sessão (anônima, se preciso) para
    // que `cliente_id` sempre aponte para um auth.users.id válido
    let { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const { data: signInData, error: erroSignIn } = await supabase.auth.signInAnonymously()
      if (erroSignIn || !signInData.user) {
        console.error(JSON.stringify({
          event: 'checkout.stripe.erro_sessao_anonima',
          error: erroSignIn?.message ?? 'Sessão não criada',
          timestamp: new Date().toISOString(),
        }))
        return NextResponse.json(
          { success: false, error: { code: 'AUTH_REQUIRED', message: 'Não foi possível iniciar sua sessão. Recarregue a página e tente novamente.' } },
          { status: 401 }
        )
      }
      user = signInData.user
    }

    // Cria o pedido e decrementa o estoque atomicamente (RPC). O preço
    // unitário é lido de produtos.preco_site dentro da função — nunca do
    // cliente — e o estoque só é decrementado se houver quantidade suficiente.
    const { error: erroPedido } = await supabase.rpc('criar_pedido_com_estoque', {
      p_pedido_id: orderId,
      p_cliente_id: user.id,
      p_forma_pagamento: 'cartao_credito',
      p_endereco_entrega: enderecoEntrega,
      p_itens: itens,
    })

    if (erroPedido) {
      const estoqueInsuficiente = erroPedido.message?.includes('ESTOQUE_INSUFICIENTE')

      console.error(JSON.stringify({
        event: 'checkout.stripe.erro_criar_pedido',
        orderId,
        error: erroPedido.message,
        timestamp: new Date().toISOString(),
      }))

      return NextResponse.json(
        {
          success: false,
          error: estoqueInsuficiente
            ? { code: 'VALIDATION_ERROR', message: 'Um ou mais produtos não têm estoque suficiente. Atualize seu carrinho e tente novamente.' }
            : { code: 'INTERNAL_ERROR', message: 'Não foi possível criar o pedido. Tente novamente.' },
        },
        { status: estoqueInsuficiente ? 409 : 500 }
      )
    }

    // Busca os itens gravados (preço autoritativo) para montar os line_items
    // do Stripe — nunca a partir do que o cliente enviou
    const { data: itensPedido, error: erroItens } = await supabase
      .from('pedido_itens')
      .select('produto_id, preco_unitario, quantidade')
      .eq('pedido_id', orderId)

    if (erroItens || !itensPedido?.length) {
      console.error(JSON.stringify({
        event: 'checkout.stripe.erro_buscar_itens',
        orderId,
        error: erroItens?.message ?? 'Nenhum item encontrado',
        timestamp: new Date().toISOString(),
      }))
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar o pedido. Tente novamente.' } },
        { status: 500 }
      )
    }

    const { data: produtosNomes } = await supabase
      .from('produtos')
      .select('id, nome')
      .in('id', itensPedido.map((item) => item.produto_id))

    const nomePorProduto = new Map((produtosNomes ?? []).map((p) => [p.id, p.nome]))
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = itensPedido.map((item) => ({
      price_data: {
        currency: 'brl',
        product_data: { name: nomePorProduto.get(item.produto_id) ?? 'Produto' },
        unit_amount: Math.round(item.preco_unitario * 100),
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
