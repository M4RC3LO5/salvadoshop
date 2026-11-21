"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Contact, Plus, Search } from "lucide-react"
import { exibirTelefone } from "@/lib/compradores/telefone"
import { COR_STATUS, ROTULO_ORIGEM, ROTULO_STATUS, formatarData, soDigitos } from "@/lib/compradores/rotulos"

export interface SegmentoOpcao {
  id: number
  nome: string
}

export interface CompradorRow {
  id: string
  empresa: string
  telefone: string | null
  celular: string | null
  celular_whatsapp: boolean
  bairro: string | null
  cidade: string | null
  uf: string | null
  status: string
  origem: string
  created_at: string
  segmento_ids: number[]
  segmentos_nomes: string[]
}

const STATUS_CHIPS = ["lead", "contato", "cliente", "descartado"] as const
const CAMPO = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"

function semAcento(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function bairroCidade(c: CompradorRow) {
  const cidadeUf = [c.cidade, c.uf].filter(Boolean).join("/")
  return [c.bairro, cidadeUf].filter(Boolean).join(" · ")
}

export function CompradoresClientUI({
  compradores,
  segmentos,
  buscasRestantes,
  mes,
  erroCarregar,
  salvo,
}: {
  compradores: CompradorRow[]
  segmentos: SegmentoOpcao[]
  buscasRestantes: number
  mes: string
  erroCarregar: boolean
  salvo: boolean
}) {
  const [busca, setBusca] = useState("")
  const [segmento, setSegmento] = useState("")
  const [status, setStatus] = useState("ativos")
  const [origem, setOrigem] = useState("")
  const [aviso, setAviso] = useState(salvo)
  const [pausado, setPausado] = useState(false)

  // Tira o ?salvo=1 do endereço para o aviso não voltar ao recarregar.
  useEffect(() => {
    if (salvo) window.history.replaceState(null, "", "/admin/compradores")
  }, [salvo])

  // O aviso some sozinho em 8 s; o tempo pausa com o mouse em cima ou o foco no "Fechar".
  useEffect(() => {
    if (!aviso || pausado) return
    const t = setTimeout(() => setAviso(false), 8000)
    return () => clearTimeout(t)
  }, [aviso, pausado])

  const contagem = useMemo(() => {
    const r: Record<string, number> = { lead: 0, contato: 0, cliente: 0, descartado: 0 }
    for (const c of compradores) r[c.status] = (r[c.status] ?? 0) + 1
    return r
  }, [compradores])

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim())
    const digitos = soDigitos(busca)
    return compradores.filter((c) => {
      if (status === "ativos" ? c.status === "descartado" : status !== "" && c.status !== status) return false
      if (origem && c.origem !== origem) return false
      if (segmento && !c.segmento_ids.includes(Number(segmento))) return false
      if (termo) {
        const texto = semAcento(`${c.empresa} ${c.bairro ?? ""}`)
        const achouTexto = texto.includes(termo)
        const achouFone =
          digitos.length > 0 && (soDigitos(c.telefone).includes(digitos) || soDigitos(c.celular).includes(digitos))
        if (!achouTexto && !achouFone) return false
      }
      return true
    })
  }, [compradores, busca, segmento, status, origem])

  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Compradores</h1>
          <p className="mt-1 text-sm text-stone-600">Quem já compra de nós e quem pode comprar.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-sm text-stone-600">
            Buscas no Google: {buscasRestantes.toLocaleString("pt-BR")} de 1.000 restantes em {mes}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/compradores/novo"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Novo comprador
            </Link>
            <button
              type="button"
              disabled
              title="Disponível em breve"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
            >
              <Search className="h-4 w-4" aria-hidden="true" /> Buscar no Google
            </button>
          </div>
        </div>
      </div>

      {aviso && (
        <p
          role="status"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Comprador salvo.
          <button
            type="button"
            onClick={() => setAviso(false)}
            onFocus={() => setPausado(true)}
            onBlur={() => setPausado(false)}
            className="text-xs underline"
          >Fechar</button>
        </p>
      )}

      {erroCarregar && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível carregar os compradores. Recarregue a página.
        </p>
      )}

      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Resumo por status">
        {STATUS_CHIPS.map((s) => (
          <li key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${COR_STATUS[s]}`}>
            {ROTULO_STATUS[s]} · {contagem[s] ?? 0}
          </li>
        ))}
      </ul>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-busca" className="mb-1 block text-xs font-medium text-stone-600">Procurar</label>
          <input
            id="f-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Empresa, bairro ou telefone"
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="f-segmento" className="mb-1 block text-xs font-medium text-stone-600">Quem compra…?</label>
          <select id="f-segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)} className={CAMPO}>
            <option value="">Todos os segmentos</option>
            {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-stone-600">Status</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className={CAMPO}>
            <option value="ativos">Todos menos descartados</option>
            {STATUS_CHIPS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-origem" className="mb-1 block text-xs font-medium text-stone-600">Origem</label>
          <select id="f-origem" value={origem} onChange={(e) => setOrigem(e.target.value)} className={CAMPO}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_ORIGEM).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
      </div>

      {compradores.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
          <Contact className="h-8 w-8 text-stone-400" aria-hidden="true" />
          <p className="text-sm text-stone-600">Nenhum comprador ainda. Cadastre os clientes atuais em + Novo comprador.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white py-10 text-center text-sm text-stone-600">
          Nenhum comprador encontrado com esses filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Empresa</th>
                <th scope="col" className="px-4 py-3">Compra</th>
                <th scope="col" className="px-4 py-3">Bairro / Cidade</th>
                <th scope="col" className="px-4 py-3">Telefone</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Origem</th>
                <th scope="col" className="px-4 py-3">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtrados.map((c) => {
                const fone = exibirTelefone(c.celular || c.telefone)
                return (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <Link href={`/admin/compradores/${c.id}`} className="hover:text-amber-700 hover:underline">
                        {c.empresa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{c.segmentos_nomes.join(", ")}</td>
                    <td className="px-4 py-3 text-stone-700">{bairroCidade(c)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {fone}
                      {c.celular && c.celular_whatsapp && <span className="ml-1 text-xs text-emerald-700">WhatsApp</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COR_STATUS[c.status] ?? ""}`}>
                        {ROTULO_STATUS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">{ROTULO_ORIGEM[c.origem] ?? c.origem}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatarData(c.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
