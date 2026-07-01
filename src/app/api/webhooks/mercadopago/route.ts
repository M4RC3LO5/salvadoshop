import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import crypto from 'crypto'

// Cliente com service role — bypassa RLS para escrita interna do webhook
function criarSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
})

// Valida a assinatura conforme documentação do Mercado Pago:
// x-signature: ts=<timestamp>,v1=<hmac-sha256>
// Payload assinado: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
function validarAssinatura(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return false

  const xSignature = request.headers.get('x-signature') ?? ''
  const xRequestId = request.headers.get('x-request-id') ?? ''

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => p.split('=') as [string, string])
  )
  const ts = partes['ts']
  const v1 = partes['v1']
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  // Comparação em tempo constante para evitar timing attacks
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1))
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    // Payload malformado — retornar 200 para o MP não reenviar
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const tipo = body['type'] as string | undefined
  const action = body['action'] as string | undefined
  const data = body['data'] as Record<string, unknown> | undefined
  const paymentId = String(data?.['id'] ?? '')

  // Validar assinatura antes de qualquer processamento
  if (!validarAssinatura(request, paymentId)) {
    console.error(JSON.stringify({
      event: 'webhook.mercadopago.assinatura_invalida',
      paymentId,
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json(
      { error: 'Assinatura inválida' },
      { status: 400 }
    )
  }

  // Ignorar eventos que não sejam payment.updated — confirmar recebimento ao MP
  if (tipo !== 'payment' || action !== 'payment.updated') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!paymentId) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const payment = new Payment(mpClient)
    const resultado = await payment.get({ id: paymentId })

    if (resultado.status !== 'approved') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const supabase = criarSupabaseAdmin()

    // 1. Atualizar status do pedido para 'pago'
    const { data: pedidoAtualizado, error: erroPedido } = await supabase
      .from('pedidos')
      .update({ status: 'pago' })
      .eq('mercadopago_id', paymentId)
      .select('id')
      .single()

    if (erroPedido || !pedidoAtualizado) {
      console.error(JSON.stringify({
        event: 'webhook.mercadopago.erro_atualizar_pedido',
        paymentId,
        error: erroPedido?.message ?? 'Pedido não encontrado',
        timestamp: new Date().toISOString(),
      }))
      // Retorna 200 mesmo assim — MP não deve reenviar por falha interna
      return NextResponse.json({ received: true }, { status: 200 })
    }

    console.log(JSON.stringify({
      event: 'webhook.mercadopago.pedido_pago',
      paymentId,
      pedidoId: pedidoAtualizado.id,
      timestamp: new Date().toISOString(),
    }))

    // 2. Buscar itens do pedido para decrementar estoque
    const { data: itens, error: erroItens } = await supabase
      .from('pedido_itens')
      .select('produto_id, quantidade')
      .eq('pedido_id', pedidoAtualizado.id)

    if (erroItens || !itens?.length) {
      console.error(JSON.stringify({
        event: 'webhook.mercadopago.erro_buscar_itens',
        pedidoId: pedidoAtualizado.id,
        error: erroItens?.message ?? 'Nenhum item encontrado',
        timestamp: new Date().toISOString(),
      }))
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // 3. Decrementar estoque de cada produto
    for (const item of itens) {
      // Busca estoque atual antes de decrementar
      const { data: produto, error: erroBusca } = await supabase
        .from('produtos')
        .select('estoque')
        .eq('id', item.produto_id)
        .single()

      if (erroBusca || !produto) {
        console.error(JSON.stringify({
          event: 'webhook.mercadopago.erro_buscar_produto',
          pedidoId: pedidoAtualizado.id,
          produtoId: item.produto_id,
          error: erroBusca?.message ?? 'Produto não encontrado',
          timestamp: new Date().toISOString(),
        }))
        continue
      }

      const novoEstoque = Math.max(0, produto.estoque - item.quantidade)

      const { error: erroEstoque } = await supabase
        .from('produtos')
        .update({ estoque: novoEstoque })
        .eq('id', item.produto_id)

      if (erroEstoque) {
        // Logar mas continuar — estoque dos demais itens deve ser decrementado
        console.error(JSON.stringify({
          event: 'webhook.mercadopago.erro_decrementar_estoque',
          pedidoId: pedidoAtualizado.id,
          produtoId: item.produto_id,
          quantidade: item.quantidade,
          error: erroEstoque.message,
          timestamp: new Date().toISOString(),
        }))
      }
    }

    console.log(JSON.stringify({
      event: 'webhook.mercadopago.estoque_decrementado',
      pedidoId: pedidoAtualizado.id,
      totalItens: itens.length,
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    // Logar mas retornar 200 — o MP não precisa reenviar por erro interno
    console.error(JSON.stringify({
      event: 'webhook.mercadopago.erro_interno',
      paymentId,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
