"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  GripVertical,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  FileDown,
  FileText,
  Printer,
  Plus,
  PackageOpen,
  Columns3,
  ImageOff,
  Pencil,
  Check,
  X,
  Trash2,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ListaRow {
  id: string
  nome: string
  created_at: string
  qtd_itens: number
}

interface ItemRow {
  id: string
  lista_id: string
  ordem: number
  foto_url: string | null
  tipo_captura: "etiqueta" | "item_avulso"
  nome: string
  marca: string | null
  sku: string | null
  ean: string | null
  qtd_embalagem: number
  num_caixas: number
  total_unidades: number
  lote: string | null
  validade: string | null
  estado: string | null
  estado_livre: string | null
  observacoes: string | null
  custo_unitario: number | null
  origem: string | null
  fornecedor: string | null
  data_entrada: string
}

type ChaveColuna =
  | "foto_url" | "nome" | "marca" | "sku" | "ean" | "qtd_embalagem" | "num_caixas"
  | "total_unidades" | "lote" | "validade" | "estado" | "custo_unitario" | "origem"
  | "fornecedor" | "observacoes" | "data_entrada"

type TipoColuna = "foto" | "texto" | "numero" | "moeda" | "data" | "select" | "textarea" | "readonly"

interface OpcaoSelect { value: string; label: string }

interface ColunaConfig {
  chave: ChaveColuna
  label: string
  tipo: TipoColuna
  editavel: boolean
  ordenavel: boolean
  opcoes?: readonly OpcaoSelect[]
}

// ── Constantes ───────────────────────────────────────────────────────────────

const OPCOES_ESTADO: readonly OpcaoSelect[] = [
  { value: "lacrado", label: "Lacrado" },
  { value: "avaria_leve", label: "Avaria leve" },
  { value: "avaria_grave", label: "Avaria grave" },
  { value: "sucata", label: "Sucata" },
]

const OPCOES_ORIGEM: readonly OpcaoSelect[] = [
  { value: "sinistro", label: "Sinistro" },
  { value: "fabricante", label: "Fabricante" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "atacado", label: "Atacado" },
  { value: "avulso", label: "Avulso" },
]

const COLUNAS: ColunaConfig[] = [
  { chave: "foto_url", label: "Foto", tipo: "foto", editavel: false, ordenavel: false },
  { chave: "nome", label: "Nome", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "marca", label: "Marca", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "sku", label: "SKU", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "ean", label: "EAN", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "qtd_embalagem", label: "Qtd/Emb.", tipo: "numero", editavel: true, ordenavel: true },
  { chave: "num_caixas", label: "Nº Caixas", tipo: "numero", editavel: true, ordenavel: true },
  { chave: "total_unidades", label: "Total Unid.", tipo: "readonly", editavel: false, ordenavel: true },
  { chave: "lote", label: "Lote", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "validade", label: "Validade", tipo: "data", editavel: true, ordenavel: true },
  { chave: "estado", label: "Estado", tipo: "select", editavel: true, ordenavel: true, opcoes: OPCOES_ESTADO },
  { chave: "custo_unitario", label: "Custo Unit.", tipo: "moeda", editavel: true, ordenavel: true },
  { chave: "origem", label: "Origem", tipo: "select", editavel: true, ordenavel: true, opcoes: OPCOES_ORIGEM },
  { chave: "fornecedor", label: "Fornecedor", tipo: "texto", editavel: true, ordenavel: true },
  { chave: "observacoes", label: "Observações", tipo: "textarea", editavel: true, ordenavel: false },
  { chave: "data_entrada", label: "Entrada", tipo: "data", editavel: false, ordenavel: true },
]

// ── Helpers de formatação ────────────────────────────────────────────────────

function formatarDataBR(iso: string): string {
  const partes = iso.split("-")
  if (partes.length !== 3) return iso
  const [ano, mes, dia] = partes
  return `${dia}/${mes}/${ano}`
}

function formatarValorExibicao(coluna: ColunaConfig, valor: string | number | null): string {
  if (valor === null || valor === undefined || valor === "") return ""
  if (coluna.tipo === "select") return coluna.opcoes?.find((o) => o.value === valor)?.label ?? String(valor)
  if (coluna.tipo === "moeda") return BRL.format(Number(valor))
  if (coluna.tipo === "data") return formatarDataBR(String(valor))
  return String(valor)
}

function escapeHtml(valor: string): string {
  const div = document.createElement("div")
  div.textContent = valor
  return div.innerHTML
}

function baixarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Diálogo de confirmação genérico ─────────────────────────────────────────

function ConfirmDialog({
  titulo, mensagem, confirmarLabel, destrutivo, carregando, onConfirmar, onCancelar,
}: {
  titulo: string
  mensagem: string
  confirmarLabel: string
  destrutivo?: boolean
  carregando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancelar} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", destrutivo ? "bg-red-100" : "bg-amber-100")}>
            <AlertTriangle className={cn("h-5 w-5", destrutivo ? "text-red-600" : "text-amber-700")} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
            <p className="mt-1 text-sm text-stone-500">{mensagem}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancelar} disabled={carregando} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
              destrutivo ? "bg-red-600 hover:bg-red-700" : "bg-amber-700 hover:bg-amber-800"
            )}
          >
            {carregando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Aguarde...</> : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Célula editável ──────────────────────────────────────────────────────────

interface CelulaEditavelProps {
  coluna: ColunaConfig
  valor: string | number | null
  emEdicao: boolean
  onIniciarEdicao: () => void
  onSalvar: (novoValor: string) => void
  onCancelar: () => void
}

function CelulaEditavel({ coluna, valor, emEdicao, onIniciarEdicao, onSalvar, onCancelar }: CelulaEditavelProps) {
  const [rascunho, setRascunho] = useState("")
  const canceladoRef = useRef(false)

  useEffect(() => {
    if (emEdicao) {
      setRascunho(valor === null || valor === undefined ? "" : String(valor))
      canceladoRef.current = false
    }
  }, [emEdicao, valor])

  if (!coluna.editavel) {
    return <span className="text-stone-500">{formatarValorExibicao(coluna, valor) || "—"}</span>
  }

  if (!emEdicao) {
    return (
      <button
        type="button"
        onClick={onIniciarEdicao}
        className="block w-full min-w-[70px] rounded px-1.5 py-1 text-left text-stone-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-700"
      >
        {formatarValorExibicao(coluna, valor) || <span className="text-stone-300">—</span>}
      </button>
    )
  }

  function confirmar() {
    if (!canceladoRef.current) onSalvar(rascunho)
  }

  function cancelar() {
    canceladoRef.current = true
    onCancelar()
  }

  const eventos = {
    autoFocus: true,
    onBlur: confirmar,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && coluna.tipo !== "textarea") { e.preventDefault(); confirmar() }
      if (e.key === "Escape") { e.preventDefault(); cancelar() }
    },
    className: "w-full min-w-[90px] rounded border border-amber-400 bg-white px-1.5 py-1 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-amber-700/30",
  }

  if (coluna.tipo === "select") {
    return (
      <select value={rascunho} onChange={(e) => setRascunho(e.target.value)} {...eventos}>
        <option value="">Selecione</option>
        {coluna.opcoes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (coluna.tipo === "textarea") {
    return <textarea rows={2} value={rascunho} onChange={(e) => setRascunho(e.target.value)} {...eventos} />
  }

  return (
    <input
      type={coluna.tipo === "numero" || coluna.tipo === "moeda" ? "number" : coluna.tipo === "data" ? "date" : "text"}
      step={coluna.tipo === "moeda" ? 0.01 : coluna.tipo === "numero" ? 1 : undefined}
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      {...eventos}
    />
  )
}

// ── Linha da tabela (arrastável) ─────────────────────────────────────────────

interface LinhaItemProps {
  item: ItemRow
  colunasExibidas: ColunaConfig[]
  selecionado: boolean
  arrastavel: boolean
  edicaoAtiva: { itemId: string; campo: ChaveColuna } | null
  onToggleSelecionado: (id: string) => void
  onIniciarEdicao: (itemId: string, campo: ChaveColuna) => void
  onSalvarCelula: (item: ItemRow, coluna: ColunaConfig, valor: string) => void
  onCancelarEdicao: () => void
}

function LinhaItem({
  item, colunasExibidas, selecionado, arrastavel, edicaoAtiva,
  onToggleSelecionado, onIniciarEdicao, onSalvarCelula, onCancelarEdicao,
}: LinhaItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !arrastavel,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-stone-100 transition-colors",
        selecionado ? "bg-amber-50/60" : "hover:bg-stone-50/60"
      )}
    >
      <td className="hidden px-2 py-2 md:table-cell">
        <button
          type="button"
          {...(arrastavel ? { ...attributes, ...listeners } : {})}
          disabled={!arrastavel}
          aria-label="Arrastar para reordenar"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-stone-400",
            arrastavel ? "cursor-grab hover:bg-stone-100 hover:text-stone-600 active:cursor-grabbing" : "cursor-not-allowed opacity-30"
          )}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={selecionado}
          onChange={() => onToggleSelecionado(item.id)}
          aria-label={`Selecionar ${item.nome}`}
          className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-700"
        />
      </td>
      {colunasExibidas.map((coluna) => (
        <td key={coluna.chave} className="px-3 py-2 align-top">
          {coluna.tipo === "foto" ? (
            <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-100">
              {item.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.foto_url} alt={item.nome} className="h-10 w-10 object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center text-stone-300">
                  <ImageOff className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
            </div>
          ) : (
            <CelulaEditavel
              coluna={coluna}
              valor={item[coluna.chave as keyof ItemRow] as string | number | null}
              emEdicao={edicaoAtiva?.itemId === item.id && edicaoAtiva?.campo === coluna.chave}
              onIniciarEdicao={() => coluna.editavel && onIniciarEdicao(item.id, coluna.chave)}
              onSalvar={(valor) => onSalvarCelula(item, coluna, valor)}
              onCancelar={onCancelarEdicao}
            />
          )}
        </td>
      ))}
    </tr>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  listasIniciais: ListaRow[]
  role: "master" | "auxiliar"
}

export function TriagemClientUI({ listasIniciais }: Props) {
  const [listas, setListas] = useState<ListaRow[]>(listasIniciais)
  const [listaSelecionadaId, setListaSelecionadaId] = useState<string | null>(listasIniciais[0]?.id ?? null)

  const [itens, setItens] = useState<ItemRow[]>([])
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [erroAcao, setErroAcao] = useState("")

  const [editandoNomeLista, setEditandoNomeLista] = useState(false)
  const [nomeListaRascunho, setNomeListaRascunho] = useState("")

  const [busca, setBusca] = useState("")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [edicaoAtiva, setEdicaoAtiva] = useState<{ itemId: string; campo: ChaveColuna } | null>(null)

  const [colunaOrdenacao, setColunaOrdenacao] = useState<ChaveColuna | null>(null)
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<"asc" | "desc">("asc")
  const [ordemManualDefinida, setOrdemManualDefinida] = useState(false)
  const [confirmarSubstituirOrdem, setConfirmarSubstituirOrdem] = useState<ChaveColuna | null>(null)

  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ChaveColuna>>(
    () => new Set(COLUNAS.map((c) => c.chave))
  )
  const [seletorColunasAberto, setSeletorColunasAberto] = useState(false)
  const seletorRef = useRef<HTMLDivElement>(null)

  const [confirmarExclusaoLote, setConfirmarExclusaoLote] = useState(false)
  const [excluindoLote, setExcluindoLote] = useState(false)
  const [exportando, setExportando] = useState<"pdf" | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  const listaSelecionada = listas.find((l) => l.id === listaSelecionadaId) ?? null
  const colunasExibidas = COLUNAS.filter((c) => colunasVisiveis.has(c.chave))

  // ── Fecha o seletor de colunas ao clicar fora ───────────────────────────────
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (seletorRef.current && !seletorRef.current.contains(e.target as Node)) setSeletorColunasAberto(false)
    }
    document.addEventListener("mousedown", aoClicarFora)
    return () => document.removeEventListener("mousedown", aoClicarFora)
  }, [])

  // ── Busca itens ao trocar de lista ──────────────────────────────────────────
  useEffect(() => {
    if (!listaSelecionadaId) {
      setItens([])
      return
    }
    buscarItens(listaSelecionadaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaSelecionadaId])

  async function buscarItens(listaId: string) {
    setCarregandoItens(true)
    setErroAcao("")
    try {
      const res = await fetch(`/api/triagem/itens?lista_id=${listaId}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErroAcao(json.error?.message ?? "Erro ao carregar os itens.")
        setItens([])
        return
      }
      setItens(json.data)
    } catch {
      setErroAcao("Erro de conexão ao carregar os itens.")
    } finally {
      setCarregandoItens(false)
      setOrdemManualDefinida(false)
      setColunaOrdenacao(null)
      setSelecionados(new Set())
    }
  }

  // ── Nome da lista — edição inline ───────────────────────────────────────────
  function iniciarEdicaoNomeLista() {
    if (!listaSelecionada) return
    setNomeListaRascunho(listaSelecionada.nome)
    setEditandoNomeLista(true)
  }

  async function salvarNomeLista() {
    const nome = nomeListaRascunho.trim()
    setEditandoNomeLista(false)
    if (!listaSelecionada || !nome || nome === listaSelecionada.nome) return
    try {
      const res = await fetch(`/api/triagem/listas/${listaSelecionada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErroAcao(json.error?.message ?? "Erro ao renomear a lista.")
        return
      }
      setListas((prev) => prev.map((l) => (l.id === listaSelecionada.id ? { ...l, nome } : l)))
    } catch {
      setErroAcao("Erro de conexão ao renomear a lista.")
    }
  }

  // ── Filtro + ordenação ──────────────────────────────────────────────────────
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return itens
    return itens.filter((i) =>
      (i.nome ?? "").toLowerCase().includes(termo) ||
      (i.marca ?? "").toLowerCase().includes(termo) ||
      (i.ean ?? "").toLowerCase().includes(termo)
    )
  }, [itens, busca])

  const itensExibidos = useMemo(() => {
    if (!colunaOrdenacao) return itensFiltrados
    const copia = [...itensFiltrados]
    copia.sort((a, b) => {
      const va = a[colunaOrdenacao as keyof ItemRow]
      const vb = b[colunaOrdenacao as keyof ItemRow]
      let resultado: number
      if (va === null || va === undefined) resultado = vb === null || vb === undefined ? 0 : -1
      else if (vb === null || vb === undefined) resultado = 1
      else if (typeof va === "number" && typeof vb === "number") resultado = va - vb
      else resultado = String(va).localeCompare(String(vb), "pt-BR")
      return direcaoOrdenacao === "asc" ? resultado : -resultado
    })
    return copia
  }, [itensFiltrados, colunaOrdenacao, direcaoOrdenacao])

  const arrastavel = !busca.trim() && !colunaOrdenacao

  function aplicarOrdenacao(coluna: ChaveColuna) {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setColunaOrdenacao(coluna)
      setDirecaoOrdenacao("asc")
    }
  }

  function clicarCabecalho(coluna: ColunaConfig) {
    if (!coluna.ordenavel) return
    if (ordemManualDefinida) {
      setConfirmarSubstituirOrdem(coluna.chave)
    } else {
      aplicarOrdenacao(coluna.chave)
    }
  }

  function confirmarESubstituirOrdem() {
    if (confirmarSubstituirOrdem) {
      setOrdemManualDefinida(false)
      aplicarOrdenacao(confirmarSubstituirOrdem)
    }
    setConfirmarSubstituirOrdem(null)
  }

  // ── Reordenar por arraste ───────────────────────────────────────────────────
  async function salvarNovaOrdem(lista: ItemRow[]) {
    try {
      const res = await fetch("/api/triagem/itens/ordenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lista.map((i) => ({ id: i.id, ordem: i.ordem }))),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErroAcao(json.error?.message ?? "Erro ao salvar a nova ordem.")
      }
    } catch {
      setErroAcao("Erro de conexão ao salvar a nova ordem.")
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItens((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      const nova = arrayMove(prev, oldIndex, newIndex).map((item, idx) => ({ ...item, ordem: idx + 1 }))
      salvarNovaOrdem(nova)
      return nova
    })
    setOrdemManualDefinida(true)
    setColunaOrdenacao(null)
  }

  // ── Edição inline de célula ─────────────────────────────────────────────────
  async function salvarCelula(item: ItemRow, coluna: ColunaConfig, valorBruto: string) {
    let valorConvertido: string | number | null

    if (coluna.tipo === "numero" || coluna.tipo === "moeda") {
      const texto = valorBruto.trim()
      valorConvertido = texto === "" ? null : Number(texto)
      if (valorConvertido !== null && !Number.isFinite(valorConvertido)) valorConvertido = null
    } else {
      const texto = valorBruto.trim()
      valorConvertido = texto === "" ? null : texto
    }

    if (coluna.chave === "nome" && !valorConvertido) {
      setErroAcao("Nome não pode ficar vazio.")
      setEdicaoAtiva(null)
      return
    }

    // qtd_embalagem/num_caixas são NOT NULL no banco — não permite limpar para vazio
    if ((coluna.chave === "qtd_embalagem" || coluna.chave === "num_caixas") && valorConvertido === null) {
      valorConvertido = 1
    }

    setEdicaoAtiva(null)

    try {
      const res = await fetch(`/api/triagem/itens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [coluna.chave]: valorConvertido }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErroAcao(json.error?.message ?? "Erro ao salvar a alteração.")
        return
      }
      setItens((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, [coluna.chave]: valorConvertido, total_unidades: json.data.total_unidades ?? it.total_unidades }
            : it
        )
      )
    } catch {
      setErroAcao("Erro de conexão. Tente novamente.")
    }
  }

  // ── Seleção ──────────────────────────────────────────────────────────────────
  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  const todosSelecionados = itensExibidos.length > 0 && itensExibidos.every((i) => selecionados.has(i.id))

  function toggleSelecionarTodos() {
    setSelecionados((prev) => {
      if (todosSelecionados) {
        const novo = new Set(prev)
        itensExibidos.forEach((i) => novo.delete(i.id))
        return novo
      }
      const novo = new Set(prev)
      itensExibidos.forEach((i) => novo.add(i.id))
      return novo
    })
  }

  // ── Exclusão em lote ─────────────────────────────────────────────────────────
  async function excluirSelecionados() {
    setExcluindoLote(true)
    try {
      const ids = Array.from(selecionados)
      await Promise.all(ids.map((id) => fetch(`/api/triagem/itens/${id}`, { method: "DELETE" })))
      setItens((prev) => prev.filter((i) => !selecionados.has(i.id)))
      setListas((prev) =>
        prev.map((l) => (l.id === listaSelecionadaId ? { ...l, qtd_itens: Math.max(0, l.qtd_itens - ids.length) } : l))
      )
      setSelecionados(new Set())
    } catch {
      setErroAcao("Erro ao excluir os itens selecionados.")
    } finally {
      setExcluindoLote(false)
      setConfirmarExclusaoLote(false)
    }
  }

  // ── Exportação ───────────────────────────────────────────────────────────────
  function colunasParaExportar(): ColunaConfig[] {
    return COLUNAS.filter((c) => colunasVisiveis.has(c.chave) && c.chave !== "foto_url")
  }

  function linhasParaExportar(): ItemRow[] {
    return selecionados.size > 0 ? itens.filter((i) => selecionados.has(i.id)) : itensExibidos
  }

  function valorExportavel(item: ItemRow, coluna: ColunaConfig): string {
    const valor = item[coluna.chave as keyof ItemRow] as string | number | null
    return formatarValorExibicao(coluna, valor)
  }

  function exportarCSV() {
    const colunas = colunasParaExportar()
    const linhas = linhasParaExportar()
    const cabecalho = colunas.map((c) => c.label)
    const corpo = linhas.map((item) => colunas.map((c) => valorExportavel(item, c)))
    const csv = [cabecalho, ...corpo]
      .map((linha) => linha.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\r\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    baixarArquivo(blob, `${listaSelecionada?.nome ?? "triagem"}.csv`)
  }

  async function exportarPDF() {
    setExportando("pdf")
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ])
      const colunas = colunasParaExportar()
      const linhas = linhasParaExportar()
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(12)
      doc.text(listaSelecionada?.nome ?? "Triagem", 14, 12)
      autoTable(doc, {
        startY: 18,
        head: [colunas.map((c) => c.label)],
        body: linhas.map((item) => colunas.map((c) => valorExportavel(item, c))),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [180, 83, 9] },
      })
      doc.save(`${listaSelecionada?.nome ?? "triagem"}.pdf`)
    } catch {
      setErroAcao("Erro ao gerar o PDF. Tente novamente.")
    } finally {
      setExportando(null)
    }
  }

  function imprimir() {
    const colunas = colunasParaExportar()
    const linhas = linhasParaExportar()
    const janela = window.open("", "_blank")
    if (!janela) {
      setErroAcao("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.")
      return
    }
    const tituloLista = listaSelecionada?.nome ?? "Triagem"
    const linhasHtml = linhas
      .map((item) => `<tr>${colunas.map((c) => `<td>${escapeHtml(valorExportavel(item, c))}</td>`).join("")}</tr>`)
      .join("")
    janela.document.write(`<!doctype html><html><head><title>${escapeHtml(tituloLista)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #292524; }
        h1 { font-size: 16px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d6d3d1; padding: 6px 8px; text-align: left; }
        th { background: #fef3c7; }
      </style></head>
      <body>
        <h1>${escapeHtml(tituloLista)}</h1>
        <table><thead><tr>${colunas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${linhasHtml}</tbody></table>
      </body></html>`)
    janela.document.close()
    janela.focus()
    janela.print()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {confirmarSubstituirOrdem && (
        <ConfirmDialog
          titulo="Substituir ordem manual?"
          mensagem="Isso substituirá a ordem manual. Continuar?"
          confirmarLabel="Continuar"
          onConfirmar={confirmarESubstituirOrdem}
          onCancelar={() => setConfirmarSubstituirOrdem(null)}
        />
      )}

      {confirmarExclusaoLote && (
        <ConfirmDialog
          titulo="Excluir itens selecionados?"
          mensagem={`Esta ação não pode ser desfeita. ${selecionados.size} ${selecionados.size === 1 ? "item será excluído" : "itens serão excluídos"}.`}
          confirmarLabel="Excluir"
          destrutivo
          carregando={excluindoLote}
          onConfirmar={excluirSelecionados}
          onCancelar={() => setConfirmarExclusaoLote(false)}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-800">Triagem de Estoque</h1>
          <Link
            href="/admin/triagem/capturar"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Capturar item
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de lista */}
          <select
            value={listaSelecionadaId ?? ""}
            onChange={(e) => setListaSelecionadaId(e.target.value || null)}
            aria-label="Selecionar lista de triagem"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
          >
            {listas.length === 0 && <option value="">Nenhuma lista</option>}
            {listas.map((l) => (
              <option key={l.id} value={l.id}>{l.nome} ({l.qtd_itens})</option>
            ))}
          </select>

          {/* Nome editável */}
          {listaSelecionada && (
            editandoNomeLista ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={nomeListaRascunho}
                  onChange={(e) => setNomeListaRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvarNomeLista()
                    if (e.key === "Escape") setEditandoNomeLista(false)
                  }}
                  className="rounded-lg border border-amber-400 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-700/30"
                />
                <button type="button" onClick={salvarNomeLista} aria-label="Confirmar nome" className="rounded-md p-1.5 text-green-600 hover:bg-green-50">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setEditandoNomeLista(false)} aria-label="Cancelar" className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={iniciarEdicaoNomeLista}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                <Pencil className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                Renomear
              </button>
            )
          )}

          <span className="ml-auto text-sm text-stone-500">
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </span>
        </div>
      </div>

      {/* Erro */}
      {erroAcao && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {erroAcao}
          <button onClick={() => setErroAcao("")} className="ml-auto text-red-500 hover:text-red-700" aria-label="Fechar erro">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {!listaSelecionada ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-stone-200 bg-white px-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
            <PackageOpen className="h-8 w-8 text-stone-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-stone-700">Nenhuma lista de triagem ainda</p>
            <p className="mt-1 text-sm text-stone-400">Capture o primeiro item para criar uma lista.</p>
          </div>
          <Link href="/admin/triagem/capturar" className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800">
            <Plus className="h-4 w-4" aria-hidden="true" /> Capturar item
          </Link>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, marca ou EAN..."
                aria-label="Buscar itens"
                className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
              />
            </div>

            {/* Seletor de colunas */}
            <div className="relative" ref={seletorRef}>
              <button
                type="button"
                onClick={() => setSeletorColunasAberto((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" /> Colunas
              </button>
              {seletorColunasAberto && (
                <div className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                  {COLUNAS.map((c) => (
                    <label key={c.chave} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={colunasVisiveis.has(c.chave)}
                        onChange={() =>
                          setColunasVisiveis((prev) => {
                            const novo = new Set(prev)
                            if (novo.has(c.chave)) novo.delete(c.chave); else novo.add(c.chave)
                            return novo
                          })
                        }
                        className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-700"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Barra de ações em lote */}
          {selecionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm font-medium text-amber-800">
                {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Exportar CSV
                </button>
                <button type="button" onClick={exportarPDF} disabled={exportando === "pdf"} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                  {exportando === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />} Exportar PDF
                </button>
                <button type="button" onClick={imprimir} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Imprimir
                </button>
                <button type="button" onClick={() => setConfirmarExclusaoLote(true)} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Excluir selecionados
                </button>
              </div>
            </div>
          )}

          {/* Exportação sem seleção — sempre acessível */}
          {selecionados.size === 0 && itens.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Exportar CSV
              </button>
              <button type="button" onClick={exportarPDF} disabled={exportando === "pdf"} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                {exportando === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />} Exportar PDF
              </button>
              <button type="button" onClick={imprimir} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Imprimir
              </button>
              <span className="self-center text-xs text-stone-400">Nada selecionado — exporta a lista inteira</span>
            </div>
          )}

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            {carregandoItens ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-stone-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando itens...
              </div>
            ) : itensExibidos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                      <th className="hidden w-8 px-2 py-3 md:table-cell" aria-hidden="true" />
                      <th className="w-8 px-2 py-3">
                        <input
                          type="checkbox"
                          checked={todosSelecionados}
                          onChange={toggleSelecionarTodos}
                          aria-label="Selecionar todos"
                          className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-700"
                        />
                      </th>
                      {colunasExibidas.map((c) => (
                        <th
                          key={c.chave}
                          onClick={() => clicarCabecalho(c)}
                          className={cn("px-3 py-3 whitespace-nowrap", c.ordenavel && "cursor-pointer select-none hover:text-stone-700")}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            {c.ordenavel && colunaOrdenacao === c.chave && (
                              direcaoOrdenacao === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={itensExibidos.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {itensExibidos.map((item) => (
                          <LinhaItem
                            key={item.id}
                            item={item}
                            colunasExibidas={colunasExibidas}
                            selecionado={selecionados.has(item.id)}
                            arrastavel={arrastavel}
                            edicaoAtiva={edicaoAtiva}
                            onToggleSelecionado={toggleSelecionado}
                            onIniciarEdicao={(itemId, campo) => setEdicaoAtiva({ itemId, campo })}
                            onSalvarCelula={salvarCelula}
                            onCancelarEdicao={() => setEdicaoAtiva(null)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <PackageOpen className="h-8 w-8 text-stone-300" aria-hidden="true" />
                <p className="text-sm text-stone-400">
                  {busca ? "Nenhum item encontrado para essa busca." : "Nenhum item nesta lista ainda."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
