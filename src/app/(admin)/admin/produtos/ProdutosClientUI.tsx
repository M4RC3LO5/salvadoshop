"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Search, Plus, Pencil, EyeOff, Trash2, PackageOpen, Loader2, X, AlertTriangle } from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProdutoRow {
  id: string
  nome: string
  slug: string
  tipo: "tipo_a" | "tipo_b"
  preco_ml: number | null
  status: string
  created_at: string
  imagem_url: string | null
}

interface Props {
  produtos: ProdutoRow[]
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
    publicado: "bg-green-100 text-green-800 ring-green-200",
    pendente:  "bg-amber-100 text-amber-800 ring-amber-200",
    rejeitado: "bg-red-100 text-red-800 ring-red-200",
    rascunho:  "bg-stone-100 text-stone-600 ring-stone-200",
  }
  const labels: Record<string, string> = {
    publicado: "Publicado",
    pendente:  "Pendente",
    rejeitado: "Rejeitado",
    rascunho:  "Rascunho",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status] ?? "bg-stone-100 text-stone-600 ring-stone-200"}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Modal de confirmação de exclusão ──────────────────────────────────────────

function ModalExcluir({
  produto,
  onConfirmar,
  onCancelar,
  excluindo,
}: {
  produto: ProdutoRow
  onConfirmar: () => void
  onCancelar: () => void
  excluindo: boolean
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancelar}
        aria-hidden="true"
      />
      {/* Painel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <h2 id="modal-titulo" className="text-base font-semibold text-stone-900">
              Excluir produto?
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Esta ação não pode ser desfeita. O produto e todas as suas imagens serão removidos permanentemente.
            </p>
          </div>
        </div>

        <p className="mb-6 rounded-lg bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700 line-clamp-2">
          {produto.nome}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={excluindo}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={excluindo}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {excluindo
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo...</>
              : <><Trash2 className="h-4 w-4" /> Excluir</>
            }
          </button>
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className="absolute right-4 top-4 rounded-md p-1 text-stone-400 hover:text-stone-600"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ProdutosClientUI({ produtos, total, pagina, porPagina, role }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const isMaster = role === "master"
  const totalPaginas = Math.ceil(total / porPagina)

  // Estado local de filtros (debounce manual para busca)
  const [buscaLocal, setBuscaLocal] = useState(searchParams.get("busca") ?? "")
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Estado de ações
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoRow | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [despublicando, setDespublicando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

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

  // ── Busca com debounce ─────────────────────────────────────────────────────

  function handleBusca(valor: string) {
    setBuscaLocal(valor)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => {
      atualizarURL({ busca: valor })
    }, 300)
    setDebounceTimer(timer)
  }

  // ── Paginação ──────────────────────────────────────────────────────────────

  function irParaPagina(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("pagina", String(p))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  // ── Despublicar ───────────────────────────────────────────────────────────

  async function despublicar(produto: ProdutoRow) {
    setDespublicando(produto.id)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/produtos/${produto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rascunho" }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao despublicar.")
        return
      }
      router.refresh()
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setDespublicando(null)
    }
  }

  // ── Excluir ───────────────────────────────────────────────────────────────

  async function confirmarExclusao() {
    if (!produtoParaExcluir) return
    setExcluindo(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/produtos/${produtoParaExcluir.id}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao excluir.")
        setProdutoParaExcluir(null)
        return
      }
      setProdutoParaExcluir(null)
      router.refresh()
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setExcluindo(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modal de exclusão */}
      {produtoParaExcluir && (
        <ModalExcluir
          produto={produtoParaExcluir}
          onConfirmar={confirmarExclusao}
          onCancelar={() => setProdutoParaExcluir(null)}
          excluindo={excluindo}
        />
      )}

      <div className="flex flex-col gap-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Produtos</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {total} {total === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          </div>
          <Link
            href="/admin/produtos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo Produto
          </Link>
        </div>

        {/* Alerta de erro */}
        {erro && (
          <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {erro}
            <button onClick={() => setErro(null)} className="ml-auto text-red-500 hover:text-red-700" aria-label="Fechar erro">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="search"
              value={buscaLocal}
              onChange={(e) => handleBusca(e.target.value)}
              placeholder="Buscar por nome..."
              aria-label="Buscar produtos por nome"
              className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          {/* Filtro status */}
          <select
            value={searchParams.get("status") ?? ""}
            onChange={(e) => atualizarURL({ status: e.target.value })}
            aria-label="Filtrar por status"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
          >
            <option value="">Todos os status</option>
            <option value="publicado">Publicado</option>
            <option value="pendente">Pendente</option>
            <option value="rejeitado">Rejeitado</option>
            <option value="rascunho">Rascunho</option>
          </select>

          {/* Filtro tipo */}
          <select
            value={searchParams.get("tipo") ?? ""}
            onChange={(e) => atualizarURL({ tipo: e.target.value })}
            aria-label="Filtrar por tipo"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
          >
            <option value="">Todos os tipos</option>
            <option value="tipo_a">Individual</option>
            <option value="tipo_b">Lote</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {produtos.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                      <th className="px-4 py-3 w-16">Foto</th>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3 whitespace-nowrap">Tipo</th>
                      <th className="px-4 py-3 whitespace-nowrap">Preço ML</th>
                      <th className="px-4 py-3 whitespace-nowrap">Preço Site</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Criado em</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {produtos.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-stone-50/60">

                        {/* Foto */}
                        <td className="px-4 py-3">
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-100 flex items-center justify-center">
                            {p.imagem_url ? (
                              <Image
                                src={p.imagem_url}
                                alt={p.nome}
                                width={40}
                                height={40}
                                className="h-10 w-10 object-cover"
                              />
                            ) : (
                              <PackageOpen className="h-5 w-5 text-stone-400" aria-hidden="true" />
                            )}
                          </div>
                        </td>

                        {/* Nome */}
                        <td className="px-4 py-3">
                          <span className="line-clamp-2 max-w-[240px] font-medium text-stone-800">
                            {p.nome}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-3">
                          {p.tipo === "tipo_a" ? (
                            <span className="text-xs text-stone-500">Individual</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-700">Lote</span>
                          )}
                        </td>

                        {/* Preço ML */}
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                          {p.tipo === "tipo_b"
                            ? <span className="text-xs text-stone-400 italic">Sob consulta</span>
                            : p.preco_ml !== null
                              ? BRL.format(p.preco_ml)
                              : "—"
                          }
                        </td>

                        {/* Preço Site */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.tipo === "tipo_b"
                            ? <span className="text-xs text-stone-400 italic">—</span>
                            : p.preco_ml !== null
                              ? <span className="font-medium text-green-700">{BRL.format(p.preco_ml * 0.82)}</span>
                              : "—"
                          }
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>

                        {/* Criado em */}
                        <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                          {formatData(p.created_at)}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">

                            {/* Editar */}
                            <Link
                              href={`/admin/produtos/${p.id}/editar`}
                              title="Editar produto"
                              className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-700"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Editar {p.nome}</span>
                            </Link>

                            {/* Despublicar — apenas Master, apenas publicados */}
                            {isMaster && p.status === "publicado" && (
                              <button
                                type="button"
                                title="Despublicar produto"
                                disabled={despublicando === p.id}
                                onClick={() => despublicar(p)}
                                className="rounded-md p-1.5 text-stone-400 transition hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-40"
                              >
                                {despublicando === p.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  : <EyeOff className="h-4 w-4" aria-hidden="true" />
                                }
                                <span className="sr-only">Despublicar {p.nome}</span>
                              </button>
                            )}

                            {/* Excluir — apenas Master */}
                            {isMaster && (
                              <button
                                type="button"
                                title="Excluir produto"
                                onClick={() => setProdutoParaExcluir(p)}
                                className="rounded-md p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Excluir {p.nome}</span>
                              </button>
                            )}
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
                    Página {pagina} de {totalPaginas} · {total} {total === 1 ? "produto" : "produtos"}
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
                <PackageOpen className="h-8 w-8 text-stone-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-stone-700">Nenhum produto encontrado</p>
                <p className="mt-1 text-sm text-stone-400">
                  {searchParams.get("busca") || searchParams.get("status") || searchParams.get("tipo")
                    ? "Tente ajustar os filtros de busca."
                    : "Comece cadastrando o primeiro produto da loja."
                  }
                </p>
              </div>
              {!searchParams.get("busca") && !searchParams.get("status") && !searchParams.get("tipo") && (
                <Link
                  href="/admin/produtos/novo"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Cadastrar primeiro produto
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
