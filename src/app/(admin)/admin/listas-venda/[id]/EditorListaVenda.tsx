"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Trash2, Check } from "lucide-react"
import { precoCaixa, totalGeral, totalItem } from "@/lib/utils/lista-venda"

export interface ItemVenda {
  id: string
  ordem: number
  descricao: string
  fabricante: string | null
  referencia: string | null
  vencimento: string | null
  qtd_caixas: number
  unid_por_caixa: number
  preco_unitario: number | null
}

type CampoItem = "descricao" | "fabricante" | "referencia" | "vencimento" | "qtd_caixas" | "unid_por_caixa" | "preco_unitario"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const INPUT =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-stone-900 hover:border-stone-300 focus:border-amber-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-600"

// ── Células editáveis: salvam ao sair do campo (blur) ou Enter; Esc cancela ──

function CelulaTexto({
  valor, onSalvar, label, className = "", opcional = false,
}: {
  valor: string | null
  onSalvar: (novo: string | null) => void
  label: string
  className?: string
  opcional?: boolean
}) {
  const [v, setV] = useState(valor ?? "")
  useEffect(() => setV(valor ?? ""), [valor])
  return (
    <input
      type="text"
      value={v}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const limpo = v.trim()
        if (limpo === (valor ?? "")) { setV(valor ?? ""); return }
        onSalvar(opcional && limpo === "" ? null : limpo)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") { setV(valor ?? ""); e.currentTarget.blur() }
      }}
      className={`${INPUT} ${className}`}
    />
  )
}

function CelulaNumero({
  valor, onSalvar, label, tipo, className = "",
}: {
  valor: number | null
  onSalvar: (novo: number | null) => void
  label: string
  tipo: "inteiro" | "preco"
  className?: string
}) {
  const formatar = (n: number | null) =>
    n === null ? "" : tipo === "preco" ? n.toFixed(2).replace(".", ",") : String(n)
  const [v, setV] = useState(formatar(valor))
  useEffect(() => setV(formatar(valor)), [valor]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="text"
      inputMode={tipo === "preco" ? "decimal" : "numeric"}
      value={v}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const txt = v.trim().replace(/\./g, "").replace(",", ".")
        if (txt === "") {
          if (valor === null) { setV(""); return }
          if (tipo === "preco") { onSalvar(null); return }
          setV(formatar(valor)); return // campos inteiros não podem ficar vazios
        }
        const n = Number(txt)
        const valido = Number.isFinite(n) && (tipo === "preco" ? true : Number.isInteger(n))
        if (!valido) { setV(formatar(valor)); return }
        const arred = tipo === "preco" ? Math.round(n * 100) / 100 : n
        if (arred === valor) { setV(formatar(valor)); return }
        onSalvar(arred)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") { setV(formatar(valor)); e.currentTarget.blur() }
      }}
      className={`${INPUT} ${className}`}
    />
  )
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function EditorListaVenda({
  listaId, tituloInicial, rodapeInicial, itensIniciais,
}: {
  listaId: string
  tituloInicial: string
  rodapeInicial: string
  itensIniciais: ItemVenda[]
}) {
  const [titulo, setTitulo] = useState(tituloInicial)
  const [rodape, setRodape] = useState(rodapeInicial)
  const [rodapeRascunho, setRodapeRascunho] = useState(rodapeInicial)
  const [itens, setItens] = useState(itensIniciais)
  const [pendentes, setPendentes] = useState(0)
  const [erro, setErro] = useState("")

  const base = `/api/admin/listas-venda/${listaId}`

  // Toda gravação passa por aqui: contador de "Salvando…" + erro visível.
  async function requisitar(url: string, init: RequestInit): Promise<{ ok: boolean; data?: unknown }> {
    setPendentes((n) => n + 1)
    setErro("")
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao salvar. Tente novamente.")
        return { ok: false }
      }
      return { ok: true, data: json.data }
    } catch {
      setErro("Erro de conexão. A última alteração pode não ter sido salva.")
      return { ok: false }
    } finally {
      setPendentes((n) => n - 1)
    }
  }

  async function salvarTitulo(novo: string | null) {
    const anterior = titulo
    const valor = (novo ?? "").trim()
    if (!valor) { setErro("O título é obrigatório."); return }
    setTitulo(valor)
    const r = await requisitar(base, { method: "PATCH", body: JSON.stringify({ titulo: valor }) })
    if (!r.ok) setTitulo(anterior)
  }

  async function salvarRodape() {
    if (rodapeRascunho === rodape) return
    const anterior = rodape
    setRodape(rodapeRascunho)
    const r = await requisitar(base, { method: "PATCH", body: JSON.stringify({ rodape: rodapeRascunho }) })
    if (!r.ok) { setRodape(anterior); setRodapeRascunho(anterior) }
  }

  async function salvarCampo(item: ItemVenda, campo: CampoItem, valor: string | number | null) {
    const anterior = item[campo]
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, [campo]: valor } : i)))
    const r = await requisitar(`${base}/itens/${item.id}`, { method: "PATCH", body: JSON.stringify({ [campo]: valor }) })
    if (!r.ok) setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, [campo]: anterior } : i)))
  }

  async function adicionarLinha() {
    const r = await requisitar(`${base}/itens`, { method: "POST" })
    if (r.ok && r.data) {
      const novo = r.data as ItemVenda
      setItens((prev) => [...prev, { ...novo, preco_unitario: novo.preco_unitario === null ? null : Number(novo.preco_unitario) }])
    }
  }

  async function removerItem(item: ItemVenda) {
    const nome = item.descricao.trim() || "esta linha em branco"
    if (!window.confirm(`Remover "${nome}" da lista de venda?`)) return
    const r = await requisitar(`${base}/itens/${item.id}`, { method: "DELETE" })
    if (r.ok) setItens((prev) => prev.filter((i) => i.id !== item.id))
  }

  async function mover(idx: number, delta: -1 | 1) {
    const alvo = idx + delta
    if (alvo < 0 || alvo >= itens.length) return
    const anterior = itens
    const nova = [...itens]
    ;[nova[idx], nova[alvo]] = [nova[alvo], nova[idx]]
    const reordenada = nova.map((i, n) => ({ ...i, ordem: n + 1 }))
    setItens(reordenada)
    // Só as duas linhas trocadas mudam de ordem.
    const trocadas = [reordenada[idx], reordenada[alvo]].map((i) => ({ id: i.id, ordem: i.ordem }))
    const r = await requisitar(`${base}/itens/ordenar`, { method: "POST", body: JSON.stringify(trocadas) })
    if (!r.ok) setItens(anterior)
  }

  const geral = totalGeral(itens)
  const semPreco = itens.filter((i) => i.preco_unitario === null).length

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/listas-venda" className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Listas de Venda
        </Link>
        <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-stone-500">
          {pendentes > 0
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Salvando…</>
            : <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> Alterações salvas</>}
        </span>
      </div>

      {erro && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <div className="mb-4">
        <label htmlFor="titulo-lista" className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Título</label>
        <input
          id="titulo-lista"
          key={titulo}
          defaultValue={titulo}
          maxLength={200}
          onBlur={(e) => { if (e.target.value.trim() !== titulo) salvarTitulo(e.target.value); else e.target.value = titulo }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-lg font-semibold text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="w-16 px-2 py-2"><span className="sr-only">Ordem</span></th>
              <th scope="col" className="px-2 py-2">Descrição</th>
              <th scope="col" className="w-32 px-2 py-2">Fabr.</th>
              <th scope="col" className="w-28 px-2 py-2">Ref.</th>
              <th scope="col" className="w-24 px-2 py-2">Vencto</th>
              <th scope="col" className="w-36 px-2 py-2">Qtd (cx × unid)</th>
              <th scope="col" className="w-24 px-2 py-2 text-right">R$ Und</th>
              <th scope="col" className="w-28 px-2 py-2 text-right">R$ Cx</th>
              <th scope="col" className="w-32 px-2 py-2 text-right">R$ Total</th>
              <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {itens.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-500">Nenhum item. Adicione uma linha abaixo.</td></tr>
            )}
            {itens.map((item, idx) => {
              const cx = precoCaixa(item)
              const total = totalItem(item)
              const semPrecoLinha = item.preco_unitario === null
              const n = idx + 1
              return (
                <tr key={item.id} className={semPrecoLinha ? "bg-amber-50/70" : undefined}>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} aria-label={`Subir a linha ${n}`} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1} aria-label={`Descer a linha ${n}`} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-1"><CelulaTexto valor={item.descricao} label={`Descrição da linha ${n}`} onSalvar={(v) => salvarCampo(item, "descricao", v ?? "")} /></td>
                  <td className="px-1 py-1"><CelulaTexto opcional valor={item.fabricante} label={`Fabricante da linha ${n}`} onSalvar={(v) => salvarCampo(item, "fabricante", v)} /></td>
                  <td className="px-1 py-1"><CelulaTexto opcional valor={item.referencia} label={`Referência da linha ${n}`} onSalvar={(v) => salvarCampo(item, "referencia", v)} /></td>
                  <td className="px-1 py-1"><CelulaTexto opcional valor={item.vencimento} label={`Vencimento da linha ${n}`} onSalvar={(v) => salvarCampo(item, "vencimento", v)} /></td>
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <CelulaNumero tipo="inteiro" valor={item.qtd_caixas} label={`Quantidade de caixas da linha ${n}`} className="text-right" onSalvar={(v) => v !== null && salvarCampo(item, "qtd_caixas", v)} />
                      <span aria-hidden="true" className="text-stone-400">×</span>
                      <CelulaNumero tipo="inteiro" valor={item.unid_por_caixa} label={`Unidades por caixa da linha ${n}`} className="text-right" onSalvar={(v) => v !== null && salvarCampo(item, "unid_por_caixa", v)} />
                    </div>
                  </td>
                  <td className="px-1 py-1"><CelulaNumero tipo="preco" valor={item.preco_unitario} label={`Preço unitário da linha ${n}`} className="text-right" onSalvar={(v) => salvarCampo(item, "preco_unitario", v)} /></td>
                  <td className="px-2 py-1 text-right tabular-nums">{cx === null ? "" : BRL.format(cx)}</td>
                  <td className="px-2 py-1 text-right font-medium tabular-nums">{total === null ? "" : BRL.format(total)}</td>
                  <td className="px-1 py-1">
                    <button type="button" onClick={() => removerItem(item)} aria-label={`Remover a linha ${n}`} className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 bg-stone-50">
              <td colSpan={8} className="px-2 py-2 text-right text-sm font-semibold text-stone-700">Total geral</td>
              <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-stone-900">{BRL.format(geral)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={adicionarLinha} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar linha
        </button>
        {semPreco > 0 && (
          <p className="text-xs text-amber-700">
            {semPreco === 1 ? "1 linha sem preço (destacada)." : `${semPreco} linhas sem preço (destacadas).`} O total geral soma só as que têm preço.
          </p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="rodape-lista" className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Rodapé</label>
        <textarea
          id="rodape-lista"
          rows={2}
          maxLength={1000}
          value={rodapeRascunho}
          onChange={(e) => setRodapeRascunho(e.target.value)}
          onBlur={salvarRodape}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
      </div>
    </div>
  )
}
