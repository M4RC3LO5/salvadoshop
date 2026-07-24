import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Cliente com service role — mesmo padrão de criarSupabaseAdmin no webhook do Stripe
function criarSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface EnderecoEntrega {
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
}

function montarHtml(params: {
  nomeComprador: string
  numeroPedido: string
  itens: { nome: string; quantidade: number; precoUnitario: number }[]
  total: number
  endereco: EnderecoEntrega
  nomeLoja: string
  emailContato: string
}): string {
  const { nomeComprador, numeroPedido, itens, total, endereco, nomeLoja, emailContato } = params

  const linhasItens = itens
    .map((item) => {
      const subtotal = item.quantidade * item.precoUnitario
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333;">${item.nome}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333; text-align: center;">${item.quantidade}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333; text-align: right;">${BRL.format(item.precoUnitario)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333; text-align: right;">${BRL.format(subtotal)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="padding: 24px; background-color: #16a34a;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">${nomeLoja}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #333333;">Olá, ${nomeComprador}!</p>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #333333;">
                  Seu pagamento foi aprovado e o pedido <strong>#${numeroPedido}</strong> já está sendo preparado.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Produto</th>
                      <th align="center" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Qtd</th>
                      <th align="right" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Preço</th>
                      <th align="right" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasItens}
                  </tbody>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 16px; font-weight: bold; color: #333333; text-align: right;">
                      Total: ${BRL.format(total)}
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 6px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase;">Endereço de entrega</p>
                      <p style="margin: 0; font-size: 14px; color: #333333;">
                        ${endereco.rua ?? '—'}, ${endereco.numero ?? '—'}${endereco.complemento ? ` — ${endereco.complemento}` : ''}<br />
                        ${endereco.bairro ?? '—'}<br />
                        ${endereco.cidade ?? '—'} - ${endereco.uf ?? '—'}<br />
                        CEP ${endereco.cep ?? '—'}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0; font-size: 14px; color: #333333;">Obrigado por comprar com a gente!</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; background-color: #f5f5f5;">
                <p style="margin: 0; font-size: 12px; color: #999999;">${nomeLoja} • ${emailContato}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

export async function enviarConfirmacaoPedido(orderId: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(JSON.stringify({
        event: 'email.confirmacao.sem_api_key',
        orderId,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = criarSupabaseAdmin()

    const { data: pedido, error: erroPedido } = await supabase
      .from('pedidos')
      .select(`
        id, total, comprador_nome, comprador_email, endereco_entrega,
        pedido_itens ( quantidade, preco_unitario, produtos ( nome ) )
      `)
      .eq('id', orderId)
      .single()

    if (erroPedido || !pedido) {
      console.error(JSON.stringify({
        event: 'email.confirmacao.pedido_nao_encontrado',
        orderId,
        error: erroPedido?.message,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    if (!pedido.comprador_email) {
      console.error(JSON.stringify({
        event: 'email.confirmacao.sem_email_comprador',
        orderId,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    const { data: config } = await supabase
      .from('configuracoes_loja')
      .select('nome_loja, email_contato')
      .limit(1)
      .maybeSingle()

    const nomeLoja = config?.nome_loja ?? 'SalvadoShop'
    const emailContato = config?.email_contato ?? ''

    const itens = (pedido.pedido_itens ?? []).map((item) => {
      const produtoJoin = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
      return {
        nome: produtoJoin?.nome ?? 'Produto',
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
      }
    })

    const endereco = (pedido.endereco_entrega ?? {}) as EnderecoEntrega

    const html = montarHtml({
      nomeComprador: pedido.comprador_nome ?? 'Cliente',
      numeroPedido: pedido.id.slice(0, 8).toUpperCase(),
      itens,
      total: pedido.total,
      endereco,
      nomeLoja,
      emailContato,
    })

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to: pedido.comprador_email,
      subject: `Pedido confirmado — ${nomeLoja}`,
      html,
    })

    console.log(JSON.stringify({
      event: 'email.confirmacao.enviado',
      orderId,
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'email.confirmacao.erro',
      orderId,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))
  }
}
