"use client"

import { useCallback, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { Receipt } from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PedidoRow {
  id: string
  status: string
  total: number
  created_at: string
  comprador_nome: string | null
  comprador_email: string | null
  codigo_rastreio: string | null
}

interface Props {
  pedidos: PedidoRow[]
  total: number
  pagina: number
  porPagina: number
  role: "master" | "auxiliar"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

// ── Badge de status ───────────────────────────────────────────────────────────

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

// ── Componente principal ──────────────────────────────────────────────────────

export function PedidosClientUI({ pedidos, total, pagina, porPagina }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const totalPaginas = Math.ceil(total / porPagina)

  // ── Atualizar URL ──────────────────────────────────────────────────────────

  const atualizarURL = useCallback((novoParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(novoParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    params.delete("pagina") // reseta paginação ao filtrar
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [searchParams, pathname, router])

  // ── Paginação ──────────────────────────────────────────────────────────────

  function irParaPagina(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("pagina", String(p))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Pedidos</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {total} {total === 1 ? "pedido encontrado" : "pedidos encontrados"}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => atualizarURL({ status: e.target.value })}
          aria-label="Filtrar por status"
          className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
        >
          <option value="">Todos os status</option>
          <option value="aguardando_pagamento">Aguardando pagamento</option>
          <option value="pago">Pago</option>
          <option value="em_separacao">Em separação</option>
          <option value="enviado">Enviado</option>
          <option value="entregue">Entregue</option>
          <option value="cancelado">Cancelado</option>
          <option value="reembolsado">Reembolsado</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {pedidos.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3 whitespace-nowrap">Pedido</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3 whitespace-nowrap">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Rastreio</th>
                    <th className="px-4 py-3 whitespace-nowrap">Data</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pedidos.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-stone-50/60">

                      {/* Pedido */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-stone-500">{p.id.slice(0, 8)}</span>
                      </td>

                      {/* Comprador */}
                      <td className="px-4 py-3">
                        <span className="block font-medium text-stone-800">
                          {p.comprador_nome ?? "—"}
                        </span>
                        {p.comprador_email && (
                          <span className="block text-xs text-stone-400">{p.comprador_email}</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-700">
                        {BRL.format(p.total)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Rastreio */}
                      <td className="px-4 py-3 text-stone-500">
                        {p.codigo_rastreio ?? "—"}
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                        {formatData(p.created_at)}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/pedidos/${p.id}`}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-700"
                          >
                            Ver detalhe
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
                <p className="text-xs text-stone-500">
                  Página {pagina} de {totalPaginas} · {total} {total === 1 ? "pedido" : "pedidos"}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => irParaPagina(pagina - 1)}
                    disabled={pagina <= 1}
                    className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => {
                    const p = totalPaginas <= 5
                      ? i + 1
                      : pagina <= 3
                        ? i + 1
                        : pagina >= totalPaginas - 2
                          ? totalPaginas - 4 + i
                          : pagina - 2 + i
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => irParaPagina(p)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          p === pagina
                            ? "bg-amber-700 text-white"
                            : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => irParaPagina(pagina + 1)}
                    disabled={pagina >= totalPaginas}
                    className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Estado vazio */
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
              <Receipt className="h-8 w-8 text-stone-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-stone-700">Nenhum pedido encontrado</p>
              <p className="mt-1 text-sm text-stone-400">
                {searchParams.get("status")
                  ? "Tente ajustar o filtro de status."
                  : "Ainda não há pedidos registrados."
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
