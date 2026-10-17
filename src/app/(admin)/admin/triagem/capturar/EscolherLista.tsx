"use client"

import { useRef, useState } from "react"
import { Loader2, Plus } from "lucide-react"

export interface ListaCaptura {
  id: string
  nome: string
  created_at: string
  qtd_itens: number
}

const FUSO = "America/Sao_Paulo"
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000

function formatarData(iso: string | Date, comAno: boolean): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    ...(comAno ? { year: "numeric" } : {}),
  }).formatToParts(typeof iso === "string" ? new Date(iso) : iso)
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ""
  return comAno ? `${pega("day")}/${pega("month")}/${pega("year")}` : `${pega("day")}/${pega("month")}`
}

function nomeSugerido(listas: ListaCaptura[]): string {
  const base = `Triagem ${formatarData(new Date(), true)}`
  const existentes = new Set(listas.map((l) => l.nome))
  if (!existentes.has(base)) return base
  let n = 2
  while (existentes.has(`${base} (${n})`)) n++
  return `${base} (${n})`
}

function textoItens(qtd: number): string {
  return `${qtd} ${qtd === 1 ? "item" : "itens"}`
}

interface Props {
  listas: ListaCaptura[]
  sugeridaId: string | null
  aviso?: string
  onEscolher: (lista: ListaCaptura) => void
}

export function EscolherLista({ listas, sugeridaId, aviso, onEscolher }: Props) {
  const [mostrarOutras, setMostrarOutras] = useState(false)
  const [criando, setCriando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState("")
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const [erro, setErro] = useState("")

  const limite = Date.now() - TRINTA_DIAS_MS
  const sugerida = sugeridaId ? listas.find((l) => l.id === sugeridaId) ?? null : null
  // Recentes (30 dias) + a sugerida mesmo que mais antiga; a API já ordena da mais nova para a mais antiga
  const visiveis = listas.filter((l) => l.id === sugerida?.id || new Date(l.created_at).getTime() >= limite)
  const principal = sugerida ?? visiveis[0] ?? null
  const outras = visiveis.filter((l) => l.id !== principal?.id)

  function abrirCriacao() {
    setNomeNovo(nomeSugerido(listas))
    setErro("")
    setCriando(true)
  }

  async function criarLista() {
    if (salvandoRef.current) return
    const nome = nomeNovo.trim()
    if (!nome) {
      setErro("Informe o nome da lista.")
      return
    }
    if (nome.length > 80) {
      setErro("O nome pode ter no máximo 80 caracteres.")
      return
    }

    salvandoRef.current = true
    setSalvando(true)
    setErro("")
    try {
      const res = await fetch("/api/triagem/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Não foi possível criar a lista. Tente novamente.")
        return
      }
      onEscolher({ id: json.data.id, nome: json.data.nome, created_at: new Date().toISOString(), qtd_itens: 0 })
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-stone-800">Em qual lista vamos trabalhar?</h2>

      {aviso && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      {principal && (
        <button
          type="button"
          onClick={() => onEscolher(principal)}
          className="flex min-h-[64px] flex-col items-start gap-0.5 rounded-xl bg-green-700 p-5 text-left text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2"
        >
          <span className="text-base font-semibold">Continuar em: {principal.nome}</span>
          <span className="text-xs text-green-100">
            {textoItens(principal.qtd_itens)} · criada em {formatarData(principal.created_at, false)}
          </span>
        </button>
      )}

      {principal && (
        <button
          type="button"
          onClick={() => setMostrarOutras((v) => !v)}
          aria-expanded={mostrarOutras}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Escolher outra lista
        </button>
      )}

      {principal && mostrarOutras && (
        <div className="flex flex-col gap-2">
          {outras.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhuma outra lista nos últimos 30 dias.</p>
          ) : (
            outras.map((lista) => (
              <button
                key={lista.id}
                type="button"
                onClick={() => onEscolher(lista)}
                className="flex min-h-[56px] flex-col items-start gap-0.5 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-amber-400 hover:bg-amber-50/40"
              >
                <span className="text-sm font-semibold text-stone-800">{lista.nome}</span>
                <span className="text-xs text-stone-500">
                  {textoItens(lista.qtd_itens)} · criada em {formatarData(lista.created_at, false)}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {!criando ? (
        <button
          type="button"
          onClick={abrirCriacao}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Começar lista nova
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <label htmlFor="nome-lista-nova" className="text-sm font-medium text-stone-700">
            Nome da lista
          </label>
          <input
            id="nome-lista-nova"
            type="text"
            value={nomeNovo}
            maxLength={80}
            onChange={(e) => setNomeNovo(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
          />
          {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
          <button
            type="button"
            onClick={criarLista}
            disabled={salvando}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {salvando ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Criando...</>
            ) : (
              "Criar e continuar"
            )}
          </button>
        </div>
      )}
    </div>
  )
}
