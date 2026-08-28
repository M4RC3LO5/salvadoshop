import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
  formaPagamento: z.enum(['pix', 'cartao_credito']),
  customerEmail: z.string().email().optional(),
  compradorNome: z.string().trim().min(2).max(120),
  compradorTelefone: z.string().trim().min(10).max(20),
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

    const { orderId, itens, enderecoEntrega, formaPagamento, customerEmail, compradorNome, compradorTelefone } = parsed.data
    const supabase = createClient()

    // Checkout de convidado: garante uma sessão (anônima, se preciso) para
    // que `cliente_id` sempre aponte para um auth.users.id válido
    let { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const { data: signInData, error: erroSignIn } = await supabase.auth.signInAnonymously()
      if (erroSignIn || !signInData.user) {
        console.error(JSON.stringify({
          event: 'checkout.pedido.erro_sessao_anonima',
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
      p_forma_pagamento: formaPagamento,
      p_endereco_entrega: enderecoEntrega,
      p_itens: itens,
    })

    if (erroPedido) {
      const estoqueInsuficiente = erroPedido.message?.includes('ESTOQUE_INSUFICIENTE')
      const naoAutorizado = erroPedido.message?.includes('UNAUTHORIZED')

      console.error(JSON.stringify({
        event: 'checkout.pedido.erro_criar_pedido',
        orderId,
        error: erroPedido.message,
        timestamp: new Date().toISOString(),
      }))

      if (naoAutorizado) {
        return NextResponse.json(
          { success: false, error: { code: 'AUTH_REQUIRED', message: 'Não foi possível validar sua sessão. Recarregue a página e tente novamente.' } },
          { status: 401 }
        )
      }

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

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Persiste os dados do comprador no pedido. Requer service role porque a
    // RLS de UPDATE em `pedidos` só permite is_master() — a sessão aqui é a do
    // cliente. O escopo é apertado de propósito: filtra por id E cliente_id
    // (mesmo com service role, só toca o pedido do próprio usuário).
    const { error: erroComprador } = await supabaseAdmin
      .from('pedidos')
      .update({
        comprador_nome: compradorNome,
        comprador_email: customerEmail ?? null,
        comprador_telefone: compradorTelefone,
      })
      .eq('id', orderId)
      .eq('cliente_id', user.id)

    if (erroComprador) {
      // Não bloqueia o checkout: o pedido e o estoque já estão corretos. Apenas
      // registra, para não perder a venda por causa de dado de contato.
      console.error(JSON.stringify({
        event: 'checkout.pedido.erro_persistir_comprador',
        orderId,
        error: erroComprador.message,
        timestamp: new Date().toISOString(),
      }))
    }

    // Busca o número sequencial (gerado pelo banco na criação) e o total, para
    // ajustar os centavos e identificar o pagamento pelo extrato.
    const { data: pedidoCriado, error: erroBusca } = await supabaseAdmin
      .from('pedidos')
      .select('numero_pedido, total')
      .eq('id', orderId)
      .single()

    if (erroBusca || !pedidoCriado) {
      console.error(JSON.stringify({
        event: 'checkout.pedido.erro_buscar_numero',
        orderId,
        error: erroBusca?.message ?? 'Pedido não encontrado',
        timestamp: new Date().toISOString(),
      }))
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível finalizar o pedido. Tente novamente.' } },
        { status: 500 }
      )
    }

    // Ajusta o total para terminar nos dois últimos dígitos do número do
    // pedido (em centavos) — permite identificar o pagamento pelo extrato,
    // já que não há mais integração automática confirmando o pagamento.
    // SEMPRE arredonda para cima (nunca para baixo): se os centavos-alvo
    // forem menores ou iguais aos centavos atuais, soma 1 real antes de
    // aplicá-los. Isso garante que o valor cobrado nunca fique menor que o
    // total real — perder a diferença é aceitável, perder a venda não.
    const totalOriginalCentavos = Math.round(pedidoCriado.total * 100)
    const reaisOriginais = Math.floor(totalOriginalCentavos / 100)
    const centavosAtuais = totalOriginalCentavos - reaisOriginais * 100
    const centavosAlvo = pedidoCriado.numero_pedido % 100

    const reaisAjustados = centavosAlvo <= centavosAtuais ? reaisOriginais + 1 : reaisOriginais
    const totalAjustadoCentavos = reaisAjustados * 100 + centavosAlvo
    const totalAjustado = totalAjustadoCentavos / 100

    if (totalAjustado !== pedidoCriado.total) {
      const { error: erroAjusteTotal } = await supabaseAdmin
        .from('pedidos')
        .update({ total: totalAjustado })
        .eq('id', orderId)

      if (erroAjusteTotal) {
        console.error(JSON.stringify({
          event: 'checkout.pedido.erro_ajustar_total',
          orderId,
          error: erroAjusteTotal.message,
          timestamp: new Date().toISOString(),
        }))
        return NextResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível finalizar o pedido. Tente novamente.' } },
          { status: 500 }
        )
      }
    }

    console.log(JSON.stringify({
      event: 'checkout.pedido.criado',
      orderId,
      numeroPedido: pedidoCriado.numero_pedido,
      formaPagamento,
      total: totalAjustado,
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        numero_pedido: pedidoCriado.numero_pedido,
        total: totalAjustado,
        forma_pagamento: formaPagamento,
      },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'checkout.pedido.error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar o pedido' } },
      { status: 500 }
    )
  }
}
