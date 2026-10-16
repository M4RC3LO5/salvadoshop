"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ClipboardList, Loader2, Trash2 } from "lucide-react"
import { MAX_EXCLUSAO_EM_MASSA } from "@/lib/lista-venda/limites"

export interface ListaVendaRow {
  id: string
  titulo: string
  created_at: string
  qtd_itens: number
  total: number
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ListasVendaClientUI({
  listasIniciais,
  erroCarregar,
}: {
  listasIniciais: ListaVendaRow[]
  erroCarregar: boolean
}) {
  const [listas, setListas] = useState(listasIniciais)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  // Listas que aguardam confirmação de exclusão (1 = individual, N = em massa)
  const [paraExcluir, setParaExcluir] = useState<ListaVendaRow[] | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState("")
  const marcarTodosRef = useRef<HTMLInputElement>(null)

  const todasMarcadas = listas.length > 0 && listas.every((l) => selecionadas.has(l.id))
  const algumaMarcada = selecionadas.size > 0

  // "Selecionar todos" fica indeterminado quando só parte está marcada
  useEffect(() => {
    if (marcarTodosRef.current) {
      marcarTodosRef.current.indeterminate = algumaMarcada && !todasMarcadas
    }
  }, [algumaMarcada, todasMarcadas])

  function alternar(id: string) {
    setSelecionadas((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  function alternarTodas() {
    setSelecionadas(todasMarcadas ? new Set() : new Set(listas.map((l) => l.id)))
  }

  function pedirExclusaoEmMassa() {
    setErro("")
    if (selecionadas.size > MAX_EXCLUSAO_EM_MASSA) {
      setErro(`Selecione no máximo ${MAX_EXCLUSAO_EM_MASSA} listas por vez.`)
      return
    }
    setParaExcluir(listas.filter((l) => selecionadas.has(l.id)))
  }

  async function confirmarExclusao() {
    if (!paraExcluir || paraExcluir.length === 0) return
    setExcluindo(true)
    setErro("")
    try {
      // Individual: rota da própria lista. Em massa: uma única requisição com todos os ids.
      const res = paraExcluir.length === 1
        ? await fetch(`/api/admin/listas-venda/${paraExcluir[0].id}`, { method: "DELETE" })
        : await fetch("/api/admin/listas-venda", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: paraExcluir.map((l) => l.id) }),
          })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao excluir.")
        return
      }
      const apagadas = new Set(paraExcluir.map((l) => l.id))
      setListas((prev) => prev.filter((l) => !apagadas.has(l.id)))
      setSelecionadas(new Set())
      setParaExcluir(null)
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setExcluindo(false)
    }
  }

  const qtdExcluir = paraExcluir?.length ?? 0
  const itensExcluir = paraExcluir?.reduce((acc, l) => acc + l.qtd_itens, 0) ?? 0

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Listas de Venda</h1>
        <p className="mt-1 text-sm text-stone-600">
          Para criar uma, abra a Triagem e clique em “Gerar lista de venda”.
        </p>
      </div>

      {(erroCarregar || erro) && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro || "Não foi possível carregar as listas. Recarregue a página."}
        </p>
      )}

      {algumaMarcada && (
        <div
          role="region"
          aria-label="Ações para as listas selecionadas"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5"
        >
          <span className="text-sm text-stone-700" aria-live="polite">
            {selecionadas.size === 1 ? "1 lista selecionada" : `${selecionadas.size} listas selecionadas`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelecionadas(new Set())}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={pedirExclusaoEmMassa}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir selecionadas ({selecionadas.size})
            </button>
          </div>
        </div>
      )}

      {listas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
          <ClipboardList className="h-8 w-8 text-stone-400" aria-hidden="true" />
          <p className="text-sm text-stone-600">Nenhuma lista de venda ainda.</p>
          <Link href="/admin/triagem" className="text-sm font-medium text-amber-700 hover:underline">
            Ir para a Triagem
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    ref={marcarTodosRef}
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={alternarTodas}
                    aria-label="Selecionar todas as listas"
                    className="h-4 w-4 rounded border-stone-300 accent-amber-700"
                  />
                </th>
                <th scope="col" className="px-4 py-3">Título</th>
                <th scope="col" className="px-4 py-3 text-right">Itens</th>
                <th scope="col" className="px-4 py-3 text-right">Total geral</th>
                <th scope="col" className="px-4 py-3">Data</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {listas.map((l) => {
                const marcada = selecionadas.has(l.id)
                return (
                  <tr key={l.id} className={marcada ? "bg-amber-50/60" : "hover:bg-stone-50"}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternar(l.id)}
                        aria-label={`Selecionar a lista ${l.titulo}`}
                        className="h-4 w-4 rounded border-stone-300 accent-amber-700"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <Link href={`/admin/listas-venda/${l.id}`} className="hover:text-amber-700 hover:underline">
                        {l.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.qtd_itens}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{BRL.format(l.total)}</td>
                    <td className="px-4 py-3 text-stone-600">{formatData(l.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setErro(""); setParaExcluir([l]) }}
                        aria-label={`Excluir a lista ${l.titulo}`}
                        className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {paraExcluir && qtdExcluir > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-titulo"
            aria-describedby="excluir-desc"
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onKeyDown={(e) => { if (e.key === "Escape" && !excluindo) setParaExcluir(null) }}
          >
            <h2 id="excluir-titulo" className="text-base font-semibold text-stone-900">
              {qtdExcluir === 1 ? "Excluir lista de venda?" : `Excluir ${qtdExcluir} listas de venda?`}
            </h2>
            <p id="excluir-desc" className="mt-2 text-sm text-stone-600">
              {qtdExcluir === 1
                ? `“${paraExcluir[0].titulo}” e seus ${itensExcluir} itens serão apagados.`
                : `${qtdExcluir} listas e seus ${itensExcluir} itens no total serão apagados.`}{" "}
              A triagem não é afetada.
            </p>
            {qtdExcluir > 1 && (
              <ul className="mt-2 max-h-28 overflow-y-auto rounded border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                {paraExcluir.map((l) => <li key={l.id} className="truncate">{l.titulo}</li>)}
              </ul>
            )}
            {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setParaExcluir(null)}
                disabled={excluindo}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {excluindo && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {qtdExcluir === 1 ? "Excluir" : `Excluir ${qtdExcluir}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
