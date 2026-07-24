import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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
  transportadora: string
  codigoRastreio: string
  urlRastreamento: string | null
  endereco: EnderecoEntrega
  nomeLoja: string
  emailContato: string
}): string {
  const { nomeComprador, numeroPedido, transportadora, codigoRastreio, urlRastreamento, endereco, nomeLoja, emailContato } = params

  const botaoRastreio = urlRastreamento
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td style="border-radius: 6px; background-color: #16a34a;">
            <a href="${urlRastreamento}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none;">Acompanhar entrega</a>
          </td>
        </tr>
      </table>
    `
    : ''

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
                  Seu pedido <strong>#${numeroPedido}</strong> foi enviado.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 6px; margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase;">Transportadora</p>
                      <p style="margin: 0 0 16px 0; font-size: 14px; color: #333333;">${transportadora}</p>
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666; text-transform: uppercase;">Código de rastreio</p>
                      <p style="margin: 0; font-size: 14px; color: #333333;">${codigoRastreio}</p>
                    </td>
                  </tr>
                </table>

                ${botaoRastreio}

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

export async function enviarRastreio(orderId: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(JSON.stringify({
        event: 'email.rastreio.sem_api_key',
        orderId,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const supabase = criarSupabaseAdmin()

    const { data: pedido, error: erroPedido } = await supabase
      .from('pedidos')
      .select('id, comprador_nome, comprador_email, codigo_rastreio, transportadora, url_rastreamento, endereco_entrega')
      .eq('id', orderId)
      .single()

    if (erroPedido || !pedido) {
      console.error(JSON.stringify({
        event: 'email.rastreio.pedido_nao_encontrado',
        orderId,
        error: erroPedido?.message,
        timestamp: new Date().toISOString(),
      }))
      return
    }

    if (!pedido.comprador_email) {
      console.error(JSON.stringify({
        event: 'email.rastreio.sem_email_comprador',
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

    const endereco = (pedido.endereco_entrega ?? {}) as EnderecoEntrega
    const numeroPedido = pedido.id.slice(0, 8).toUpperCase()

    const html = montarHtml({
      nomeComprador: pedido.comprador_nome ?? 'Cliente',
      numeroPedido,
      transportadora: pedido.transportadora ?? '—',
      codigoRastreio: pedido.codigo_rastreio ?? '—',
      urlRastreamento: pedido.url_rastreamento ?? null,
      endereco,
      nomeLoja,
      emailContato,
    })

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to: pedido.comprador_email,
      subject: `Seu pedido #${numeroPedido} foi enviado — ${nomeLoja}`,
      html,
    })

    console.log(JSON.stringify({
      event: 'email.rastreio.enviado',
      orderId,
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'email.rastreio.erro',
      orderId,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
    }))
  }
}
