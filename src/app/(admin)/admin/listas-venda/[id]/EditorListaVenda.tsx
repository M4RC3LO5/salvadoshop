"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowDown, ArrowUp, Check, CheckCircle2, FileSpreadsheet, Loader2, Plus, Printer, RotateCcw, Trash2 } from "lucide-react"
import { precoCaixa, totalGeral, totalItem } from "@/lib/utils/lista-venda"
import { FOLHA_CSS_PAGINA } from "@/lib/lista-venda/folha-css"
import { EMPRESA, LIMITE_DESCRICAO_LONGA } from "@/lib/lista-venda/empresa"
import {
  COLUNAS_LISTA,
  LARGURAS_PADRAO,
  redimensionar,
  type LargurasColunas,
} from "@/lib/lista-venda/larguras"

// A tela do editor tem exatamente a altura da janela (a página não rola, só a
// folha), descontando o que o layout do admin (admin/layout.tsx) põe em volta:
//   celular = barra do topo h-14 (3.5rem) + padding p-6 do main (3rem) + folga 0.1rem
//   desktop = padding p-6 do main (3rem) + folga 0.1rem
// (o padding p-4/lg:p-8 da própria tela já está dentro da altura, border-box.)
// Se o layout do admin mudar (barra, padding), estes valores têm que mudar junto.
const ALTURA_TELA_EDITOR = "h-[calc(100dvh-6.6rem)] lg:h-[calc(100dvh-3.1rem)]"

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
type EstadoLarguras = "ocioso" | "salvando" | "salvo" | "erro"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const ATRASO_SALVAR_MS = 500
const PASSO_TECLADO_PCT = 0.5

// ── Células editáveis: salvam ao sair do campo (blur) ou Enter; Esc cancela ──
// Na tela o campo parece o texto da folha; no papel sai o texto (.so-papel).

// Auto-altura: o campo cresce com o texto e acompanha a largura da coluna
// (que muda ao arrastar a alça). Texto sempre visível por inteiro.
function useAutoAltura(ref: React.RefObject<HTMLTextAreaElement>, dependencia: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let larguraAnterior = -1
    const ajustar = () => {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
    ajustar()
    // A fonte da folha pode chegar depois da primeira medida: mede de novo quando carregar.
    document.fonts?.ready.then(ajustar)
    const observador = new ResizeObserver(() => {
      if (el.clientWidth !== larguraAnterior) {
        larguraAnterior = el.clientWidth
        ajustar()
      }
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [ref, dependencia])
}

function CelulaTexto({
  valor, onSalvar, label, opcional = false, multilinha = false, maxLength,
}: {
  valor: string | null
  onSalvar: (novo: string | null) => void
  label: string
  opcional?: boolean
  multilinha?: boolean
  maxLength?: number
}) {
  const [v, setV] = useState(valor ?? "")
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setV(valor ?? ""), [valor])
  useAutoAltura(ref, v)

  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        value={v}
        aria-label={label}
        title={v || undefined}
        maxLength={maxLength}
        // Uma linha lógica só (exceto o aviso): quebras coladas viram espaço.
        onChange={(e) => setV(multilinha ? e.target.value : e.target.value.replace(/\s*\n+\s*/g, " "))}
        onBlur={() => {
          const limpo = multilinha ? v : v.trim()
          if (limpo === (valor ?? "")) { setV(valor ?? ""); return }
          onSalvar(opcional && limpo === "" ? null : limpo)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(multilinha && !e.ctrlKey)) { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === "Escape") { setV(valor ?? ""); e.currentTarget.blur() }
        }}
        className="edit"
      />
      <span className="so-papel">{valor ?? ""}</span>
    </>
  )
}

function CelulaNumero({
  valor, onSalvar, label, tipo, papel,
}: {
  valor: number | null
  onSalvar: (novo: number | null) => void
  label: string
  tipo: "inteiro" | "preco"
  // Texto que sai no papel no lugar do campo (omitido quando o pai cuida disso)
  papel?: string
}) {
  const formatar = (n: number | null) =>
    n === null ? "" : tipo === "preco" ? n.toFixed(2).replace(".", ",") : String(n)
  const [v, setV] = useState(formatar(valor))
  useEffect(() => setV(formatar(valor)), [valor]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
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
        className="edit"
      />
      {papel !== undefined && <span className="so-papel">{papel}</span>}
    </>
  )
}

// Valores muito grandes (ex.: R$ 1.481.400,00) usam fonte menor para caber na célula.
function Moeda({ valor }: { valor: number | null }) {
  const txt = valor === null ? "" : BRL.format(valor)
  return <td className={`direita num${txt.length > 12 ? " apertada" : ""}`}>{txt}</td>
}

// ── Editor: a folha A4 editável ──────────────────────────────────────────────

export function EditorListaVenda({
  listaId, tituloInicial, rodapeInicial, itensIniciais, larguras: largurasIniciais,
}: {
  listaId: string
  tituloInicial: string
  rodapeInicial: string
  itensIniciais: ItemVenda[]
  larguras: LargurasColunas
}) {
  const [titulo, setTitulo] = useState(tituloInicial)
  const [tituloChave, setTituloChave] = useState(0)
  const [rodape, setRodape] = useState(rodapeInicial)
  const [itens, setItens] = useState(itensIniciais)
  const [pendentes, setPendentes] = useState(0)
  const [erro, setErro] = useState("")
  const [exportando, setExportando] = useState(false)
  const [ultimoSalvo, setUltimoSalvo] = useState<"alteracoes" | "larguras">("alteracoes")

  const [larguras, setLarguras] = useState(largurasIniciais)
  const [estadoLarguras, setEstadoLarguras] = useState<EstadoLarguras>("ocioso")
  const [erroLarguras, setErroLarguras] = useState("")
  const tabelaRef = useRef<HTMLTableElement>(null)
  const linhaTituloRef = useRef<HTMLTableRowElement>(null)
  const [alturaTitulo, setAlturaTitulo] = useState(28)
  const barraRef = useRef<HTMLDivElement>(null)
  const [alturaBarra, setAlturaBarra] = useState(48)
  // Linha recém-criada: depois de renderizar, a tela rola até ela e foca a descrição.
  const [focarLinhaId, setFocarLinhaId] = useState<string | null>(null)
  // Última linha sem preço visitada pelo clique em "N sem preço" (percurso circular).
  const ultimaSemPrecoId = useRef<string | null>(null)
  const larguraAtual = useRef(larguras)
  const arraste = useRef<{ indice: number; inicioX: number; base: LargurasColunas; larguraTabela: number } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const base = `/api/admin/listas-venda/${listaId}`

  useEffect(() => { larguraAtual.current = larguras }, [larguras])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  // Regra @page (A4 + "Página X de Y"): tem aspas, então não pode ir no <style> renderizado
  // pelo servidor (ver folha-css.ts). Entra no <head> só enquanto esta tela está aberta.
  useEffect(() => {
    const estilo = document.createElement("style")
    estilo.textContent = FOLHA_CSS_PAGINA
    document.head.appendChild(estilo)
    return () => { estilo.remove() }
  }, [])

  // O cabeçalho das colunas gruda logo abaixo da linha do título, qualquer que seja a altura dela.
  useLayoutEffect(() => {
    const el = linhaTituloRef.current
    if (!el) return
    const medir = () => setAlturaTitulo(el.offsetHeight)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // A barra fixa fica no topo da área rolável; o título e o cabeçalho das colunas grudam logo abaixo dela.
  useLayoutEffect(() => {
    const el = barraRef.current
    if (!el) return
    const medir = () => setAlturaBarra(el.offsetHeight)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

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
      setUltimoSalvo("alteracoes")
      return { ok: true, data: json.data }
    } catch {
      setErro("Erro de conexão. A última alteração pode não ter sido salva.")
      return { ok: false }
    } finally {
      setPendentes((n) => n - 1)
    }
  }

  async function salvarTitulo(novo: string | null) {
    const valor = (novo ?? "").trim()
    if (!valor) {
      setErro("O título é obrigatório.")
      setTituloChave((k) => k + 1) // remonta o campo com o título anterior
      return
    }
    const anterior = titulo
    setTitulo(valor)
    const r = await requisitar(base, { method: "PATCH", body: JSON.stringify({ titulo: valor }) })
    if (!r.ok) setTitulo(anterior)
  }

  async function salvarRodape(novo: string | null) {
    const valor = novo ?? ""
    if (valor === rodape) return
    const anterior = rodape
    setRodape(valor)
    const r = await requisitar(base, { method: "PATCH", body: JSON.stringify({ rodape: valor }) })
    if (!r.ok) setRodape(anterior)
  }

  async function salvarCampo(item: ItemVenda, campo: CampoItem, bruto: string | number | null) {
    // Descrição e fabricante ficam em caixa alta (o trigger 040 garante o mesmo no banco).
    const valor =
      (campo === "descricao" || campo === "fabricante") && typeof bruto === "string"
        ? bruto.toLocaleUpperCase("pt-BR")
        : bruto
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
      setFocarLinhaId(novo.id)
    }
  }

  // Depois que a linha nova aparece, rola até ela e foca a descrição.
  useEffect(() => {
    if (!focarLinhaId) return
    const linha = document.querySelector<HTMLElement>(`[data-item-id="${focarLinhaId}"]`)
    if (!linha) return
    linha.scrollIntoView({ block: "center" })
    linha.querySelector<HTMLTextAreaElement>('textarea[aria-label^="Descrição"]')?.focus({ preventScroll: true })
    setFocarLinhaId(null)
  }, [focarLinhaId, itens])

  // "N sem preço": cada clique vai para a próxima linha sem preço (circular) e foca o R$ UND dela.
  function irParaProximaSemPreco() {
    if (!itens.some((i) => i.preco_unitario === null)) return
    // Segue a partir da posição da última visitada (mesmo que ela já tenha ganhado preço) e dá a volta no fim.
    const inicio = ultimaSemPrecoId.current ? itens.findIndex((i) => i.id === ultimaSemPrecoId.current) + 1 : 0
    let alvoId = ""
    for (let k = 0; k < itens.length; k++) {
      const candidato = itens[(inicio + k) % itens.length]
      if (candidato.preco_unitario === null) { alvoId = candidato.id; break }
    }
    if (!alvoId) return
    ultimaSemPrecoId.current = alvoId
    const linha = document.querySelector<HTMLElement>(`[data-item-id="${alvoId}"]`)
    if (!linha) return
    linha.scrollIntoView({ block: "center" })
    linha.querySelector<HTMLInputElement>('input[aria-label^="Preço unitário"]')?.focus({ preventScroll: true })
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

  // ── Larguras das colunas (alças de arraste) ──

  const gravarLarguras = useCallback(async (valor: LargurasColunas | null) => {
    setEstadoLarguras("salvando")
    setErroLarguras("")
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ larguras_colunas: valor }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setEstadoLarguras("erro")
        setErroLarguras(json.error?.message ?? "Não foi possível salvar as larguras.")
        return
      }
      setEstadoLarguras("salvo")
      setUltimoSalvo("larguras")
    } catch {
      setEstadoLarguras("erro")
      setErroLarguras("Erro de conexão ao salvar as larguras.")
    }
  }, [base])

  // Salva ao soltar a alça, com debounce (vários ajustes seguidos viram uma gravação).
  const agendarSalvarLarguras = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setEstadoLarguras("salvando")
    temporizador.current = setTimeout(() => gravarLarguras(larguraAtual.current), ATRASO_SALVAR_MS)
  }, [gravarLarguras])

  function iniciarArraste(e: React.PointerEvent<HTMLSpanElement>, indice: number) {
    const tabela = tabelaRef.current
    if (!tabela) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    arraste.current = {
      indice,
      inicioX: e.clientX,
      base: larguraAtual.current,
      larguraTabela: tabela.getBoundingClientRect().width,
    }
  }

  function moverArraste(e: React.PointerEvent<HTMLSpanElement>) {
    const a = arraste.current
    if (!a || a.larguraTabela <= 0) return
    const deltaPct = ((e.clientX - a.inicioX) / a.larguraTabela) * 100
    setLarguras(redimensionar(a.base, a.indice, deltaPct))
  }

  function soltarArraste(e: React.PointerEvent<HTMLSpanElement>) {
    if (!arraste.current) return
    arraste.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    agendarSalvarLarguras()
  }

  // Teclado: ← → ajustam a coluna em passos de 0,5 ponto percentual.
  function tecladoAlca(e: React.KeyboardEvent<HTMLSpanElement>, indice: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const passo = e.key === "ArrowRight" ? PASSO_TECLADO_PCT : -PASSO_TECLADO_PCT
    setLarguras((atual) => {
      const nova = redimensionar(atual, indice, passo)
      larguraAtual.current = nova
      return nova
    })
    agendarSalvarLarguras()
  }

  function restaurarPadrao() {
    if (temporizador.current) clearTimeout(temporizador.current)
    setLarguras({ ...LARGURAS_PADRAO })
    larguraAtual.current = { ...LARGURAS_PADRAO }
    gravarLarguras(null)
  }

  async function exportarExcel() {
    setExportando(true)
    setErro("")
    try {
      const { gerarXlsxListaVenda } = await import("@/lib/lista-venda/exportar-xlsx")
      const { blob, nomeArquivo } = await gerarXlsxListaVenda({ titulo, rodape, itens, larguras })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setErro("Erro ao gerar o Excel. Tente novamente.")
    } finally {
      setExportando(false)
    }
  }

  const geral = totalGeral(itens)
  const semPreco = itens.filter((i) => i.preco_unitario === null).length
  const ehPadrao = COLUNAS_LISTA.every((c) => larguras[c.chave] === LARGURAS_PADRAO[c.chave])
  const salvando = pendentes > 0 || estadoLarguras === "salvando"
  const botaoBarra = "inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white p-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 sm:px-3 sm:py-1.5"
  const textoBotao = "sr-only sm:not-sr-only"

  return (
    <div className={`lista-folha mx-auto flex max-w-7xl flex-col p-4 lg:p-8 ${ALTURA_TELA_EDITOR} print:block print:h-auto print:max-w-none print:p-0`} style={{ "--h-barra": `${alturaBarra}px`, "--h-titulo": `${alturaTitulo}px` } as React.CSSProperties}>
      {/* Área rolável (dentro dela a folha rola para o lado no celular): título e cabeçalho da tabela ficam fixos ao rolar */}
      <div data-rolagem-principal className="min-h-0 flex-1 overflow-auto print:overflow-visible" style={{ scrollPaddingTop: "calc(var(--h-barra) + var(--h-titulo) + 32px)" }}>
        {/* Barra fixa: o resumo do que sai no rodapé e as ações ficam sempre à vista ao rolar */}
        <div ref={barraRef} className="sticky left-0 top-0 z-30 border-b border-stone-200 bg-stone-100 pb-2 print:hidden">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Link href="/admin/listas-venda" aria-label="Voltar para Listas de Venda" className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Listas de Venda</span>
            </Link>

            <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-700 sm:text-sm">
              <span><span className="hidden sm:inline">Total geral </span><span className="sm:hidden">Total </span><strong className="tabular-nums">{BRL.format(geral)}</strong></span>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <span>{itens.length === 1 ? "1 linha" : `${itens.length} linhas`}</span>
              <span aria-hidden="true" className="text-stone-300">|</span>
              {semPreco > 0 ? (
                <button
                  type="button"
                  onClick={irParaProximaSemPreco}
                  title="Ir para a próxima linha sem preço"
                  className="rounded font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  {semPreco} sem preço
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Todas com preço
                </span>
              )}
            </p>

            <div className="ml-auto flex items-center gap-2">
              <span role="status" aria-live="polite" className="mr-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                {salvando
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Salvando…</>
                  : estadoLarguras === "erro"
                    ? <span className="text-red-600">{erroLarguras}</span>
                    : <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> {ultimoSalvo === "larguras" ? "Larguras salvas" : "Alterações salvas"}</>}
              </span>
              <button type="button" onClick={adicionarLinha} aria-label="Adicionar linha" title="Adicionar linha" className={botaoBarra}>
                <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" /> <span className={textoBotao}>Adicionar linha</span>
              </button>
              <button type="button" onClick={restaurarPadrao} disabled={ehPadrao || estadoLarguras === "salvando"} aria-label="Restaurar larguras" title="Restaurar larguras" className={botaoBarra}>
                <RotateCcw className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" /> <span className={textoBotao}>Restaurar larguras</span>
              </button>
              <button type="button" onClick={() => window.print()} aria-label="Imprimir" title="Imprimir" className={botaoBarra}>
                <Printer className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" /> <span className={textoBotao}>Imprimir</span>
              </button>
              <button type="button" onClick={exportarExcel} disabled={salvando || exportando} aria-label="Exportar Excel" title="Exportar Excel" className={botaoBarra}>
                {exportando ? <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />} <span className={textoBotao}>Exportar Excel</span>
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}
        </div>

        <p className="sticky left-0 my-2 text-xs text-stone-500 print:hidden">
          Clique em qualquer campo para editar. Arraste a borda de um título de coluna para ajustar a largura (ou use ← → na alça focada).
        </p>

        <div className="folha-area">
          <div className="folha">
            <div className="mb-[9mm]">
              <Image
                src={EMPRESA.logoPublicPath}
                alt="Comercial Dantas de Salvados e Sinistros — compra e venda por atacado, desde 2004"
                width={EMPRESA.logoLargura}
                height={EMPRESA.logoAltura}
                unoptimized
                priority
                style={{ width: "100mm", height: "auto" }}
              />
            </div>

            <table ref={tabelaRef}>
              <colgroup>
                {COLUNAS_LISTA.map((c) => (
                  <col key={c.chave} style={{ width: `${larguras[c.chave]}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr ref={linhaTituloRef}>
                  <th colSpan={COLUNAS_LISTA.length} className="titulo">
                    <CelulaTexto key={tituloChave} valor={titulo} label="Título da lista" maxLength={200} onSalvar={salvarTitulo} />
                  </th>
                </tr>
                <tr>
                  {COLUNAS_LISTA.map((c, indice) => (
                    <th key={c.chave} scope="col">
                      {c.rotulo}
                      {/* Alça de arraste: só na tela, nunca no papel. A última coluna não tem (a tabela tem largura fixa). */}
                      {indice < COLUNAS_LISTA.length - 1 && (
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Redimensionar a coluna ${c.rotulo}`}
                          aria-valuemin={c.minimo}
                          aria-valuenow={larguras[c.chave]}
                          tabIndex={0}
                          className="alca print:hidden"
                          onPointerDown={(e) => iniciarArraste(e, indice)}
                          onPointerMove={moverArraste}
                          onPointerUp={soltarArraste}
                          onPointerCancel={soltarArraste}
                          onKeyDown={(e) => tecladoAlca(e, indice)}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr className="print:hidden"><td colSpan={COLUNAS_LISTA.length} className="centro">Nenhum item. Use “Adicionar linha” acima.</td></tr>
                )}
                {itens.map((item, idx) => {
                  const cx = precoCaixa(item)
                  const total = totalItem(item)
                  const n = idx + 1
                  return (
                    <tr key={item.id} data-item-id={item.id} className={item.preco_unitario === null ? "sem-preco" : undefined}>
                      <td className={`col-desc${item.descricao.length > LIMITE_DESCRICAO_LONGA ? " longa" : ""}`}>
                        {/* Calha de controles: fica à esquerda, fora das colunas da folha; nunca sai no papel */}
                        <span className="calha">
                          <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} aria-label={`Subir a linha ${n}`}>
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1} aria-label={`Descer a linha ${n}`}>
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button type="button" className="remover" onClick={() => removerItem(item)} aria-label={`Remover a linha ${n}`}>
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                        <CelulaTexto valor={item.descricao} label={`Descrição da linha ${n}`} onSalvar={(v) => salvarCampo(item, "descricao", v ?? "")} />
                      </td>
                      <td className="centro fab"><CelulaTexto opcional valor={item.fabricante} label={`Fabricante da linha ${n}`} onSalvar={(v) => salvarCampo(item, "fabricante", v)} /></td>
                      <td className="centro"><CelulaTexto opcional valor={item.referencia} label={`Referência da linha ${n}`} onSalvar={(v) => salvarCampo(item, "referencia", v)} /></td>
                      <td className="centro"><CelulaTexto opcional valor={item.vencimento} label={`Vencimento da linha ${n}`} onSalvar={(v) => salvarCampo(item, "vencimento", v)} /></td>
                      <td className="centro num">
                        <div className="qtd-edit">
                          <CelulaNumero tipo="inteiro" valor={item.qtd_caixas} label={`Quantidade de caixas da linha ${n}`} onSalvar={(v) => v !== null && salvarCampo(item, "qtd_caixas", v)} />
                          <span aria-hidden="true" className="print:hidden">x</span>
                          <CelulaNumero tipo="inteiro" valor={item.unid_por_caixa} label={`Unidades por caixa da linha ${n}`} onSalvar={(v) => v !== null && salvarCampo(item, "unid_por_caixa", v)} />
                        </div>
                        <span className="so-papel qtd-papel">{item.qtd_caixas} &nbsp;x&nbsp; {item.unid_por_caixa}</span>
                      </td>
                      <td className={`direita num${item.preco_unitario !== null && BRL.format(item.preco_unitario).length > 12 ? " apertada" : ""}`}>
                        <CelulaNumero tipo="preco" valor={item.preco_unitario} label={`Preço unitário da linha ${n}`} papel={item.preco_unitario === null ? "" : BRL.format(item.preco_unitario)} onSalvar={(v) => salvarCampo(item, "preco_unitario", v)} />
                      </td>
                      <Moeda valor={cx} />
                      <Moeda valor={total} />
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="total-geral">{BRL.format(geral)}</div>

            <div className="aviso">
              <CelulaTexto multilinha valor={rodape} label="Aviso (rodapé da lista)" maxLength={1000} onSalvar={salvarRodape} />
            </div>

            <div className="rodape-empresa">
              {EMPRESA.linhasRodape.map((linha) => (
                <div key={linha}>{linha}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
