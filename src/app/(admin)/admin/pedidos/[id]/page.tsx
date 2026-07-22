import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

interface PageProps {
  params: { id: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aguardando_pagamento: "bg-amber-100 text-amber-800 ring-amber-200",
    pago:                 "bg-green-100 text-green-800 ring-green-200",
    em_separacao:         "bg-blue-100 text-blue-800 ring-blue-200",
    enviado:              "bg-indigo-100 text-indigo-800 ring-indigo-200",
    entregue:             "bg-emerald-100 text-emerald-800 ring-emerald-200",
    cancelado:            "bg-red-100 text-red-800 ring-red-200",
    reembolsado:          "bg-stone-100 text-stone-600 ring-stone-200",
  }
  const labels: Record<string, string> = {
    aguardando_pagamento: "Aguardando pagamento",
    pago:                 "Pago",
    em_separacao:         "Em separação",
    enviado:              "Enviado",
    entregue:             "Entregue",
    cancelado:            "Cancelado",
    reembolsado:          "Reembolsado",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status] ?? "bg-stone-100 text-stone-600 ring-stone-200"}`}>
      {labels[status] ?? status}
    </span>
  )
}

const labelsFormaPagamento: Record<string, string> = {
  cartao_credito: "Cartão de crédito",
  cartao_debito:  "Cartão de débito",
  pix:            "Pix",
}

// ── Componente ────────────────────────────────────────────────────────────────

export default async function DetalhePedidoPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) redirect("/admin/login")

  // Master e Auxiliar veem todos os pedidos (decisão de negócio; RLS já permite)
  const { data: pedido } = await supabase
    .from("pedidos")
    .select(`
      id, status, total, forma_pagamento, created_at, updated_at,
      comprador_nome, comprador_email, comprador_telefone,
      endereco_entrega, codigo_rastreio, transportadora, url_rastreamento,
      pedido_itens ( quantidade, preco_unitario, produtos ( nome ) )
    `)
    .eq("id", params.id)
    .single()

  if (!pedido) notFound()

  const endereco = (pedido.endereco_entrega ?? {}) as Record<string, string | undefined>

  const itens = (pedido.pedido_itens ?? []).map((item) => {
    const produtoJoin = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
    return {
      nome: produtoJoin?.nome ?? null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    }
  })

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/pedidos"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar para pedidos
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-800">
            Pedido #<span className="font-mono">{pedido.id.slice(0, 8)}</span>
          </h1>
          <StatusBadge status={pedido.status} />
        </div>
      </div>

      {/* Grid: Comprador + Entrega */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Card Comprador */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-stone-800">Comprador</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Nome</dt>
              <dd className="text-right font-medium text-stone-800">{pedido.comprador_nome ?? "Não informado"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">E-mail</dt>
              <dd className="text-right font-medium text-stone-800">{pedido.comprador_email ?? "Não informado"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Telefone</dt>
              <dd className="text-right font-medium text-stone-800">{pedido.comprador_telefone ?? "Não informado"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-stone-400">
            Pedidos criados antes desta funcionalidade podem não ter esses dados registrados.
          </p>
        </div>

        {/* Card Entrega */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-stone-800">Entrega</h2>
          <div className="flex flex-col gap-1 text-sm text-stone-700">
            <p>
              {endereco.rua ?? "—"}, {endereco.numero ?? "—"}
              {endereco.complemento ? ` — ${endereco.complemento}` : ""}
            </p>
            <p>{endereco.bairro ?? "—"}</p>
            <p>{endereco.cidade ?? "—"} - {endereco.uf ?? "—"}</p>
            <p>CEP {endereco.cep ?? "—"}</p>
          </div>

          <hr className="my-4 border-stone-100" />

          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Transportadora</dt>
              <dd className="text-right font-medium text-stone-800">{pedido.transportadora ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">Código de rastreio</dt>
              <dd className="text-right font-medium text-stone-800">{pedido.codigo_rastreio ?? "—"}</dd>
            </div>
          </dl>
          {pedido.url_rastreamento && (
            <a
              href={pedido.url_rastreamento}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-amber-700 hover:underline"
            >
              Acompanhar entrega
            </a>
          )}
        </div>
      </div>

      {/* Card Itens */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <h2 className="px-5 pt-5 text-base font-bold text-stone-800">Itens</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-5 py-3">Produto</th>
                <th className="px-5 py-3 whitespace-nowrap">Quantidade</th>
                <th className="px-5 py-3 whitespace-nowrap">Preço unitário</th>
                <th className="px-5 py-3 whitespace-nowrap">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {itens.map((item, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-stone-800">
                    {item.nome ?? <span className="italic text-stone-400">Produto removido</span>}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-stone-600">{item.quantidade}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-stone-600">{BRL.format(item.preco_unitario)}</td>
                  <td className="px-5 py-3 whitespace-nowrap font-medium text-stone-800">
                    {BRL.format(item.preco_unitario * item.quantidade)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-stone-100 px-5 py-4">
          <p className="text-base font-bold text-stone-800">
            Total: <span className="text-lg">{BRL.format(pedido.total)}</span>
          </p>
        </div>
      </div>

      {/* Card Informações */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-stone-800">Informações</h2>
        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Forma de pagamento</dt>
            <dd className="text-right font-medium text-stone-800">
              {labelsFormaPagamento[pedido.forma_pagamento] ?? pedido.forma_pagamento}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Criado em</dt>
            <dd className="text-right font-medium text-stone-800">{formatDataHora(pedido.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Última atualização</dt>
            <dd className="text-right font-medium text-stone-800">{formatDataHora(pedido.updated_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
