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
  numeroPedido: string
  total: number
  compradorNome: string
  compradorEmail: string
  compradorTelefone: string
  itens: { nome: string; quantidade: number; precoUnitario: number }[]
  endereco: EnderecoEntrega
  nomeLoja: string
  urlPainel: string
}): string {
  const { numeroPedido, total, compradorNome, compradorEmail, compradorTelefone, itens, endereco, nomeLoja, urlPainel } = params

  const linhasItens = itens
    .map((item) => {
      const subtotal = item.quantidade * item.precoUnitario
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333;">${item.nome}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #333333; text-align: center;">${item.quantidade}</td>
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
              <td style="padding: 24px; background-color: #1d4ed8;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">${nomeLoja}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #333333;">Novo pedido recebido</p>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #333333;">
                  Pedido <strong>#${numeroPedido}</strong> — total de <strong>${BRL.format(total)}</strong>
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 6px; margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase;">Comprador</p>
                      <p style="margin: 0; font-size: 14px; color: #333333;">
                        ${compradorNome}<br />
                        ${compradorEmail}<br />
                        ${compradorTelefone}
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Produto</th>
                      <th align="center" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Qtd</th>
                      <th align="right" style="padding: 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; color: #666666; text-transform: uppercase;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasItens}
                  </tbody>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 6px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase;">Entrega</p>
                      <p style="margin: 0; font-size: 14px; color: #333333;">
                        ${endereco.rua ?? '—'}, ${endereco.numero ?? '—'}${endereco.complemento ? ` — ${endereco.complemento}` : ''}<br />
                        ${endereco.bairro ?? '—'}<br />
                        ${endereco.cidade ?? '—'} - ${endereco.uf ?? '—'}<br />
                        CEP ${endereco.cep ?? '—'}
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius: 6px; background-color: #1d4ed8;">
                      <a href="${urlPainel}" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none;">Ver pedido no painel</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

export async function enviarNotificacaoAdmin(orderId: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(JSON.stringify({
        event: 'email.admin.sem_api_key',
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
        id, total, comprador_nome, comprador_email, comprador_telefone,
        endereco_entrega,
        pedido_itens ( quantidade, preco_unitario, produtos ( nome ) )
      `)
      .eq('id', orderId)
      .single()

    if (erroPedido || !pedido) {
      console.error(JSON.stringify({
        event: 'email.admin.pedido_nao_encontrado',
        orderId,
        error: erroPedido?.message,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    const { data: config } = await supabase
      .from('configuracoes_loja')
      .select('nome_loja, email_notificacoes')
      .limit(1)
      .maybeSingle()

    if (!config?.email_notificacoes) {
      console.error(JSON.stringify({
        event: 'email.admin.sem_destinatario',
        orderId,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    const nomeLoja = config?.nome_loja ?? 'SalvadoShop'

    const itens = (pedido.pedido_itens ?? []).map((item) => {
      const produtoJoin = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
      return {
        nome: produtoJoin?.nome ?? 'Produto',
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
      }
    })

    const endereco = (pedido.endereco_entrega ?? {}) as EnderecoEntrega
    const numeroPedido = pedido.id.slice(0, 8).toUpperCase()
    const urlPainel = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.lojadossalvados.com.br'}/admin/pedidos/${pedido.id}`

    const html = montarHtml({
      numeroPedido,
      total: pedido.total,
      compradorNome: pedido.comprador_nome ?? 'Não informado',
      compradorEmail: pedido.comprador_email ?? 'Não informado',
      compradorTelefone: pedido.comprador_telefone ?? 'Não informado',
      itens,
      endereco,
      nomeLoja,
      urlPainel,
    })

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to: config.email_notificacoes,
      subject: `Novo pedido #${numeroPedido} — ${nomeLoja}`,
      html,
    })

    console.log(JSON.stringify({
      event: 'email.admin.enviado',
      orderId,
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'email.admin.erro',
      orderId,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))
  }
}
