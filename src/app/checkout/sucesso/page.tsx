import Link from "next/link"
import Image from "next/image"
import QRCode from "qrcode"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { gerarPixBRCode } from "@/lib/pix/gerar-br-code"
import { LimpaCarrinhoNoSucesso } from "./LimpaCarrinhoNoSucesso"
import { CopiarCodigoPix } from "./CopiarCodigoPix"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

interface PaginaCheckoutSucessoProps {
  searchParams: { pedido?: string }
}

interface ItemResumo {
  nome: string
  quantidade: number
  precoUnitario: number
}

function montarUrlWhatsApp(mensagem: string) {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`
}

export default async function PaginaCheckoutSucesso({ searchParams }: PaginaCheckoutSucessoProps) {
  const pedidoId = searchParams.pedido

  if (!pedidoId) {
    return <EstadoNaoEncontrado />
  }

  // O cliente (inclusive sessão anônima de guest checkout) só enxerga o
  // próprio pedido — RLS "Clientes veem seus próprios pedidos" (cliente_id
  // = auth.uid()). Não usamos service role aqui de propósito: se o cookie de
  // sessão não bater com o dono do pedido, a consulta simplesmente vem vazia.
  const supabase = createClient()
  const { data: pedido } = await supabase
    .from("pedidos")
    .select(`
      id, numero_pedido, status, total, forma_pagamento, created_at,
      pedido_itens ( quantidade, preco_unitario, produtos ( nome ) )
    `)
    .eq("id", pedidoId)
    .maybeSingle()

  if (!pedido) {
    return <EstadoNaoEncontrado />
  }

  const itens: ItemResumo[] = (pedido.pedido_itens ?? []).map((item) => {
    const produtoJoin = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
    return {
      nome: produtoJoin?.nome ?? "Produto",
      quantidade: item.quantidade,
      precoUnitario: item.preco_unitario,
    }
  })

  let pixQrCodeDataUrl: string | null = null
  let pixCopiaCola: string | null = null

  if (pedido.forma_pagamento === "pix" && pedido.status === "aguardando_pagamento") {
    // configuracoes_loja só é legível por admins via RLS — a chave Pix precisa
    // de service role para ser lida nesta página pública de instruções.
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: config } = await supabaseAdmin
      .from("configuracoes_loja")
      .select("pix_chave, pix_beneficiario, pix_cidade")
      .limit(1)
      .maybeSingle()

    if (config?.pix_chave && config?.pix_beneficiario && config?.pix_cidade) {
      pixCopiaCola = gerarPixBRCode({
        chave: config.pix_chave,
        beneficiario: config.pix_beneficiario,
        cidade: config.pix_cidade,
        valor: pedido.total,
        txid: `PED${pedido.numero_pedido}`,
      })

      try {
        pixQrCodeDataUrl = await QRCode.toDataURL(pixCopiaCola, { width: 240, margin: 1 })
      } catch (error) {
        console.error(JSON.stringify({
          event: "checkout.sucesso.erro_gerar_qrcode",
          pedidoId: pedido.id,
          error: error instanceof Error ? error.message : "Erro desconhecido",
          timestamp: new Date().toISOString(),
        }))
      }
    } else {
      console.error(JSON.stringify({
        event: "checkout.sucesso.config_pix_incompleta",
        pedidoId: pedido.id,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  const totalFormatado = BRL.format(pedido.total)
  const centavos = String(pedido.numero_pedido % 100).padStart(2, "0")

  // Os preços dos itens são o snapshot original (antes do ajuste de centavos
  // que identifica o pedido) — mostramos a diferença como uma linha própria
  // para o resumo sempre fechar com o total real cobrado.
  const subtotalItens = itens.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0)
  const ajusteCentavos = Math.round((pedido.total - subtotalItens) * 100) / 100

  const mensagemWhatsApp = pedido.forma_pagamento === "pix"
    ? `Olá! Já paguei o Pix do pedido #${pedido.numero_pedido}, no valor de ${totalFormatado}.`
    : `Olá! Quero finalizar o pagamento do pedido #${pedido.numero_pedido} (${totalFormatado}) no cartão de crédito. Pode me enviar o link de pagamento?`

  const urlWhatsApp = montarUrlWhatsApp(mensagemWhatsApp)

  return (
    <div className="container py-8 px-4 max-w-lg mx-auto">
      <LimpaCarrinhoNoSucesso />

      <div className="flex flex-col items-center text-center gap-2 mb-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-marrom-800">Pedido registrado!</h1>
        <p className="text-2xl font-bold text-marrom-800">
          #{pedido.numero_pedido}
        </p>
      </div>

      <div className="flex flex-col gap-4">

        {pedido.status === "aguardando_pagamento" ? (
          <>
            {/* ── Aviso de reserva ── */}
            <div className="flex items-center gap-3 bg-ambar-50 border border-ambar-200 rounded-xl px-4 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ambar-600 shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-sm text-ambar-800 font-medium">
                Seu pedido fica reservado por <strong>24 horas</strong>. Após esse prazo, sem confirmação de pagamento, ele é cancelado.
              </p>
            </div>

            {pedido.forma_pagamento === "pix" ? (
              <SecaoPix
                pixQrCodeDataUrl={pixQrCodeDataUrl}
                pixCopiaCola={pixCopiaCola}
                totalFormatado={totalFormatado}
                centavos={centavos}
                urlWhatsApp={urlWhatsApp}
              />
            ) : (
              <SecaoCartao totalFormatado={totalFormatado} urlWhatsApp={urlWhatsApp} />
            )}
          </>
        ) : (
          <EstadoStatusAtualizado status={pedido.status} />
        )}

        {/* ── Resumo do pedido ── */}
        <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="text-base font-bold text-marrom-800">Resumo do pedido</h2>
          <ul className="flex flex-col gap-2">
            {itens.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-700 flex-1 line-clamp-1">{item.nome}</span>
                <span className="text-zinc-400 shrink-0">× {item.quantidade}</span>
                <span className="text-zinc-800 font-medium shrink-0">
                  {BRL.format(item.precoUnitario * item.quantidade)}
                </span>
              </li>
            ))}
          </ul>
          <hr className="border-zinc-100" />
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal</span>
              <span>{BRL.format(subtotalItens)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Ajuste (identifica seu pedido)</span>
              <span>{BRL.format(ajusteCentavos)}</span>
            </div>
          </div>
          <hr className="border-zinc-100" />
          <div className="flex justify-between items-center font-bold text-marrom-800">
            <span>Total</span>
            <span className="text-lg">{totalFormatado}</span>
          </div>
        </section>

        <Link href="/" className="inline-flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-300 text-zinc-600 text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
          Voltar à loja
        </Link>
      </div>
    </div>
  )
}

// ── Seção Pix ─────────────────────────────────────────────────────────────

function SecaoPix({
  pixQrCodeDataUrl,
  pixCopiaCola,
  totalFormatado,
  centavos,
  urlWhatsApp,
}: {
  pixQrCodeDataUrl: string | null
  pixCopiaCola: string | null
  totalFormatado: string
  centavos: string
  urlWhatsApp: string
}) {
  return (
    <>
      <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col items-center gap-4">
        <h2 className="text-base font-bold text-marrom-800 self-start">Pagar com Pix</h2>

        {pixQrCodeDataUrl ? (
          <div className="border border-zinc-100 rounded-xl p-3 bg-white">
            <Image src={pixQrCodeDataUrl} alt="QR Code Pix para pagamento" width={220} height={220} unoptimized priority />
          </div>
        ) : (
          <div className="w-[220px] h-[220px] bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 text-sm text-center px-4" aria-label="QR Code indisponível">
            QR Code indisponível no momento. Use o código copia e cola ou fale com a gente pelo WhatsApp.
          </div>
        )}

        <p className="text-xs text-zinc-400 text-center">
          Aponte a câmera do celular para o QR Code acima
        </p>
      </section>

      <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="text-base font-bold text-marrom-800">Pix Copia e Cola</h2>
        <CopiarCodigoPix codigo={pixCopiaCola ?? ""} />
      </section>

      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-sm text-green-800">
          Valor exato: <strong>{totalFormatado}</strong>. Os centavos (<strong>{centavos}</strong>) identificam este pedido no nosso extrato — pague o valor exato, sem arredondar.
        </p>
      </div>

      <a
        href={urlWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors"
      >
        <IconeWhatsApp />
        Já paguei, avisar no WhatsApp
      </a>
    </>
  )
}

// ── Seção Cartão ──────────────────────────────────────────────────────────

function SecaoCartao({ totalFormatado, urlWhatsApp }: { totalFormatado: string; urlWhatsApp: string }) {
  return (
    <section className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <h2 className="text-base font-bold text-marrom-800">Pagar no cartão de crédito</h2>
      <p className="text-sm text-zinc-600">
        Vamos te enviar o link de pagamento seguro pelo WhatsApp, no valor de <strong>{totalFormatado}</strong>. É só chamar a gente.
      </p>
      <a
        href={urlWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors"
      >
        <IconeWhatsApp />
        Receber link de pagamento
      </a>
    </section>
  )
}

function IconeWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

// ── Estado com status já atualizado (revisita à página após confirmação) ──

const LABELS_STATUS: Record<string, string> = {
  pago: "Pagamento confirmado! Já vamos separar seu pedido.",
  em_separacao: "Seu pedido está em separação.",
  enviado: "Seu pedido já foi enviado.",
  entregue: "Seu pedido foi entregue.",
  cancelado: "Este pedido foi cancelado.",
  reembolsado: "Este pedido foi reembolsado.",
}

function EstadoStatusAtualizado({ status }: { status: string }) {
  const cancelado = status === "cancelado" || status === "reembolsado"
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        cancelado ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${cancelado ? "text-red-600" : "text-green-600"}`} aria-hidden="true">
        {cancelado ? (
          <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
        ) : (
          <polyline points="20 6 9 17 4 12" />
        )}
      </svg>
      <p className={`text-sm font-medium ${cancelado ? "text-red-800" : "text-green-800"}`}>
        {LABELS_STATUS[status] ?? `Status do pedido: ${status}`}
      </p>
    </div>
  )
}

// ── Estado não encontrado ─────────────────────────────────────────────────

function EstadoNaoEncontrado() {
  return (
    <div className="container py-8 px-4 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-marrom-800 mb-2">Pedido não encontrado</h1>
          <p className="text-sm text-zinc-500">
            Não encontramos esse pedido, ou ele não pertence à sua sessão atual.
          </p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
          Voltar à loja
        </Link>
      </div>
    </div>
  )
}
