"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { ArrowLeft, ArrowDown, ArrowUp, Bold, Check, CheckCircle2, FileSpreadsheet, Italic, Loader2, Plus, Printer, RotateCcw, Strikethrough, Trash2, Underline } from "lucide-react"
import { precoCaixa, totalGeral, totalItem } from "@/lib/utils/lista-venda"
import { FOLHA_CSS_PAGINA } from "@/lib/lista-venda/folha-css"
import { EMPRESA, LIMITE_DESCRICAO_LONGA } from "@/lib/lista-venda/empresa"
import {
  COLUNAS_LISTA,
  LARGURAS_PADRAO,
  redimensionar,
  type ChaveColuna,
  type LargurasColunas,
} from "@/lib/lista-venda/larguras"
import { ESTILOS, alternarEstilo, chaveEstilo, estiloCss, normalizarFormatacao, type EstiloChave, type FormatacaoItem } from "@/lib/lista-venda/formatacao"

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
  formatacao: FormatacaoItem
}

type CampoItem = "descricao" | "fabricante" | "referencia" | "vencimento" | "qtd_caixas" | "unid_por_caixa" | "preco_unitario"
type EstadoLarguras = "ocioso" | "salvando" | "salvo" | "erro"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const ATRASO_SALVAR_MS = 500
const PASSO_TECLADO_PCT = 0.5

// Marcas de quebra de página (só na tela). Área útil de uma folha na impressão:
// A4 (297mm) menos as margens do @page (8mm em cima, 12mm embaixo) = 277mm.
// As alturas são medidas numa cópia invisível da folha com as regras do papel (FolhaMedicao), não na
// tela editável. Mesmo assim é uma ESTIMATIVA: a referência final é a prévia do Ctrl+P.
// Folga (mm) descontada da área útil, para preferir quebrar uma linha antes a uma linha depois do papel.
// Com a medida no modo papel a estimativa já bate com o Ctrl+P (lista de 47 itens: linha 31 termina em
// 276,6mm de 277mm); qualquer folga acima de ~0,4mm empurra essa linha para a página seguinte.
const PX_POR_MM = 96 / 25.4
const FOLGA_MM = 0
const ALTURA_UTIL_PX = (277 - FOLGA_MM) * PX_POR_MM
const MARGEM_LOGO_PX = 9 * PX_POR_MM // mb-[9mm] abaixo do logo
const MARGENS_BLOCO_FINAL_PX = (1 + 7) * PX_POR_MM // margin-top do total geral (1mm) e do aviso (7mm)

interface QuebraPagina {
  pagina: number
  topo: number
}
interface PaginasFolha {
  total: number
  quebras: QuebraPagina[]
}

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
  valor, onSalvar, label, opcional = false, multilinha = false, maxLength, formato = "",
}: {
  // formato: muda quando a formatação da célula muda (negrito alarga o texto e pode quebrar a linha)
  formato?: string
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
  useAutoAltura(ref, v + "|" + formato)

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
function Moeda({
  valor, ativa = false, ...props
}: { valor: number | null; ativa?: boolean } & Pick<React.TdHTMLAttributes<HTMLTableCellElement>, "style" | "onClick" | "onFocus" | "onKeyDown">) {
  const txt = valor === null ? "" : BRL.format(valor)
  return <td className={`direita num${txt.length > 12 ? " apertada" : ""}${ativa ? " celula-ativa" : ""}`} {...props}>{txt}</td>
}

// ── Cópia invisível da folha, só para medir a quebra de página ──────────────
// Mesmo conteúdo e mesmas larguras da folha, mas com as regras do papel (.modo-papel): campos viram
// texto (.so-papel), sem calha, sem bordas separadas, largura útil do papel (210mm - 2x8mm de @page).
// As classes das células espelham as da tabela editável; ao mudar uma, mude a outra.
function FolhaMedicao({
  titulo, rodape, itens, larguras, geral,
}: {
  titulo: string
  rodape: string
  itens: ItemVenda[]
  larguras: LargurasColunas
  geral: number
}) {
  return (
    <div
      className="medicao-papel"
      aria-hidden="true"
      style={{ position: "fixed", top: 0, left: "-10000px", width: "194mm", visibility: "hidden", pointerEvents: "none" }}
    >
      <div className="folha modo-papel">
        <div data-med="logo" className="mb-[9mm]">
          <Image src={EMPRESA.logoPublicPath} alt="" width={EMPRESA.logoLargura} height={EMPRESA.logoAltura} unoptimized style={{ width: "100mm", height: "auto" }} />
        </div>
        <table>
          <colgroup>
            {COLUNAS_LISTA.map((c) => (
              <col key={c.chave} style={{ width: `${larguras[c.chave]}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th colSpan={COLUNAS_LISTA.length} className="titulo"><span className="so-papel">{titulo}</span></th>
            </tr>
            <tr>
              {COLUNAS_LISTA.map((c) => (
                <th key={c.chave} scope="col">{c.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const apertada = item.preco_unitario !== null && BRL.format(item.preco_unitario).length > 12
              return (
                <tr key={item.id}>
                  <td style={estiloCss(item.formatacao.descricao)} className={`col-desc${item.descricao.length > LIMITE_DESCRICAO_LONGA ? " longa" : ""}`}><span className="so-papel">{item.descricao}</span></td>
                  <td style={estiloCss(item.formatacao.fabr)} className="centro fab"><span className="so-papel">{item.fabricante ?? ""}</span></td>
                  <td style={estiloCss(item.formatacao.ref)} className="centro"><span className="so-papel">{item.referencia ?? ""}</span></td>
                  <td style={estiloCss(item.formatacao.vencto)} className="centro"><span className="so-papel">{item.vencimento ?? ""}</span></td>
                  <td style={estiloCss(item.formatacao.qtd)} className="centro num"><span className="so-papel qtd-papel">{item.qtd_caixas} &nbsp;x&nbsp; {item.unid_por_caixa}</span></td>
                  <td style={estiloCss(item.formatacao.und)} className={`direita num${apertada ? " apertada" : ""}`}><span className="so-papel">{item.preco_unitario === null ? "" : BRL.format(item.preco_unitario)}</span></td>
                  <Moeda valor={precoCaixa(item)} style={estiloCss(item.formatacao.cx)} />
                  <Moeda valor={totalItem(item)} style={estiloCss(item.formatacao.total)} />
                </tr>
              )
            })}
          </tbody>
        </table>
        <div data-med="total" className="total-geral">{BRL.format(geral)}</div>
        <div data-med="aviso" className="aviso"><span className="so-papel">{rodape}</span></div>
        <div data-med="rodape" className="rodape-empresa">
          {EMPRESA.linhasRodape.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </div>
      </div>
    </div>
  )
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
  // Remoção de linha: confirmação em diálogo próprio (window.confirm não funciona no navegador embutido do app).
  const [removerAlvo, setRemoverAlvo] = useState<ItemVenda | null>(null)
  const [removendo, setRemovendo] = useState(false)
  // Marcas de quebra de página
  const folhaRef = useRef<HTMLDivElement>(null)
  const medicaoRef = useRef<HTMLDivElement>(null)
  // Célula ativa para a formatação: a última que recebeu foco (ou clique, nas de só leitura).
  const [ativa, setAtiva] = useState<{ itemId: string; coluna: ChaveColuna } | null>(null)
  const totalGeralRef = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState<PaginasFolha>({ total: 1, quebras: [] })
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

  // Simula a quebra de página da impressão com as alturas da cópia de medição (regras do papel): a página 1
  // leva o logo e o cabeçalho, as demais só o cabeçalho (ele repete); linha nunca quebra no meio; o bloco
  // final (total, aviso, endereço) conta na última página e, se não couber nela, vai para uma página a mais.
  // A posição da marca vem da linha correspondente na tela (mesma ordem da cópia).
  const recalcularPaginas = useCallback(() => {
    const folha = folhaRef.current
    const tabela = tabelaRef.current
    const medicao = medicaoRef.current
    if (!folha || !tabela || !medicao) return
    const altura = (el: Element | null) => el?.getBoundingClientRect().height ?? 0
    const cabecalho = altura(medicao.querySelector("thead"))
    const logo = altura(medicao.querySelector("[data-med=logo]")) + MARGEM_LOGO_PX
    const linhasPapel = Array.from(medicao.querySelectorAll("tbody tr"))
    const linhasTela = Array.from(tabela.tBodies[0]?.querySelectorAll<HTMLTableRowElement>("tr[data-item-id]") ?? [])
    const topoFolha = folha.getBoundingClientRect().top

    let usado = logo + cabecalho
    let pagina = 1
    const quebras: QuebraPagina[] = []
    linhasPapel.forEach((linha, i) => {
      const h = altura(linha)
      const inicioDaPagina = pagina === 1 ? logo + cabecalho : cabecalho
      if (usado + h > ALTURA_UTIL_PX && usado > inicioDaPagina) {
        pagina += 1
        usado = cabecalho
        const naTela = linhasTela[i]
        if (naTela) quebras.push({ pagina, topo: Math.round(naTela.getBoundingClientRect().top - topoFolha) })
      }
      usado += h
    })

    const bloco =
      altura(medicao.querySelector("[data-med=total]")) +
      altura(medicao.querySelector("[data-med=aviso]")) +
      altura(medicao.querySelector("[data-med=rodape]")) +
      MARGENS_BLOCO_FINAL_PX
    if (usado + bloco > ALTURA_UTIL_PX) {
      pagina += 1
      const topoBloco = totalGeralRef.current?.getBoundingClientRect().top ?? topoFolha
      quebras.push({ pagina, topo: Math.round(topoBloco - topoFolha) })
    }

    const novo: PaginasFolha = { total: pagina, quebras }
    setPaginas((atual) => (JSON.stringify(atual) === JSON.stringify(novo) ? atual : novo))
  }, [])

  // Recalcula quando linhas são adicionadas, removidas, reordenadas ou editadas e quando as larguras mudam...
  useLayoutEffect(() => {
    recalcularPaginas()
  }, [recalcularPaginas, itens, larguras, titulo, rodape])

  // ...e quando uma linha muda de altura sozinha (texto que quebra, fonte que carrega).
  useEffect(() => {
    const observador = new ResizeObserver(() => recalcularPaginas())
    // Cada linha (e não só a tabela): uma linha pode crescer enquanto outra encolhe sem a tabela mudar de altura.
    // Observa a cópia de medição (alturas do papel) e a tabela da tela (posição das marcas).
    medicaoRef.current?.querySelectorAll("[data-med=logo], thead, tbody tr, [data-med=aviso]").forEach((el) => observador.observe(el))
    tabelaRef.current?.querySelectorAll("thead, tbody tr[data-item-id]").forEach((el) => observador.observe(el))
    if (tabelaRef.current) observador.observe(tabelaRef.current)
    document.fonts?.ready.then(recalcularPaginas)
    return () => observador.disconnect()
  }, [recalcularPaginas, itens])

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

  // Liga/desliga um estilo na célula ativa. Otimista; reverte se a gravação falhar.
  async function alternarFormato(estilo: EstiloChave, alvo = ativa) {
    if (!alvo) return
    const item = itens.find((i) => i.id === alvo.itemId)
    if (!item) return
    const anterior = item.formatacao
    const novo = alternarEstilo(anterior, alvo.coluna, estilo)
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, formatacao: novo } : i)))
    const r = await requisitar(`${base}/itens/${item.id}`, { method: "PATCH", body: JSON.stringify({ formatacao: novo }) })
    if (!r.ok) setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, formatacao: anterior } : i)))
  }

  // Props comuns das células de dados: marca como ativa, aplica a formatação e atende Ctrl+B/I/U.
  function celula(item: ItemVenda, coluna: ChaveColuna) {
    const alvo = { itemId: item.id, coluna }
    return {
      style: estiloCss(item.formatacao[coluna]),
      onFocus: () => setAtiva((a) => (a?.itemId === alvo.itemId && a.coluna === coluna ? a : alvo)),
      onClick: () => setAtiva((a) => (a?.itemId === alvo.itemId && a.coluna === coluna ? a : alvo)),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
        const estilo = ({ b: "n", i: "i", u: "s" } as Record<string, EstiloChave>)[e.key.toLowerCase()]
        if (!estilo) return
        e.preventDefault()
        alternarFormato(estilo, alvo)
      },
    }
  }
  const eAtiva = (item: ItemVenda, coluna: ChaveColuna) => ativa?.itemId === item.id && ativa.coluna === coluna
  const sufixoAtiva = (item: ItemVenda, coluna: ChaveColuna) => (eAtiva(item, coluna) ? " celula-ativa" : "")

  async function adicionarLinha() {
    const r = await requisitar(`${base}/itens`, { method: "POST" })
    if (r.ok && r.data) {
      const novo = r.data as ItemVenda
      setItens((prev) => [...prev, { ...novo, preco_unitario: novo.preco_unitario === null ? null : Number(novo.preco_unitario), formatacao: normalizarFormatacao(novo.formatacao) }])
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

  async function confirmarRemocao() {
    if (!removerAlvo) return
    setRemovendo(true)
    const r = await requisitar(`${base}/itens/${removerAlvo.id}`, { method: "DELETE" })
    if (r.ok) setItens((prev) => prev.filter((i) => i.id !== removerAlvo.id))
    setRemovendo(false)
    setRemoverAlvo(null)
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
  const botaoBarra = "inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white p-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 sm:px-3 sm:py-1.5"
  const textoBotao = "sr-only sm:not-sr-only"
  const itemAtivo = ativa ? itens.find((i) => i.id === ativa.itemId) : undefined
  const estiloAtivo = itemAtivo && ativa ? itemAtivo.formatacao[ativa.coluna] : undefined
  const iconesEstilo = { n: Bold, i: Italic, s: Underline, t: Strikethrough }

  return (
    <div className={`lista-folha mx-auto flex max-w-7xl flex-col p-4 lg:p-8 ${ALTURA_TELA_EDITOR} print:block print:h-auto print:max-w-none print:p-0`} style={{ "--h-barra": `${alturaBarra}px`, "--h-titulo": `${alturaTitulo}px` } as React.CSSProperties}>
      {/* Área rolável (dentro dela a folha rola para o lado no celular): título e cabeçalho da tabela ficam fixos ao rolar */}
      <div data-rolagem-principal className="min-h-0 flex-1 overflow-auto print:overflow-visible" style={{ scrollPaddingTop: "calc(var(--h-barra) + var(--h-titulo) + 32px)" }}>
        {/* Barra fixa: o resumo do que sai no rodapé e as ações ficam sempre à vista ao rolar */}
        <div ref={barraRef} className="sticky left-0 top-0 z-30 border-b border-stone-200 bg-stone-100 pb-2 print:hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
            <Link href="/admin/listas-venda" aria-label="Voltar para Listas de Venda" className="order-2 inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 sm:order-none">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Listas de Venda</span>
            </Link>

            <p className="order-1 flex w-full flex-wrap items-center gap-x-2 text-xs text-stone-700 sm:order-none sm:w-auto sm:text-sm">
              <span><span className="hidden sm:inline">Total geral </span><span className="sm:hidden">Total </span><strong className="tabular-nums">{BRL.format(geral)}</strong></span>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <span>{itens.length === 1 ? "1 linha" : `${itens.length} linhas`}</span>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <span title="Estimativa: a referência final é a prévia da impressão (Ctrl+P)">{paginas.total === 1 ? "1 página" : `${paginas.total} páginas`}</span>
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

            <div role="group" aria-label="Formatação da célula selecionada" className="order-2 inline-flex overflow-hidden rounded-md border border-stone-300 bg-white sm:order-none">
              {ESTILOS.map(({ chave, rotulo, atalho }, k) => {
                const Icone = iconesEstilo[chave]
                const ligado = !!estiloAtivo?.[chave]
                return (
                  <button
                    key={chave}
                    type="button"
                    // Não tira o foco do campo que está sendo editado (nem dispara o blur que salvaria o texto pela metade)
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => alternarFormato(chave)}
                    disabled={!itemAtivo}
                    aria-pressed={ligado}
                    aria-label={rotulo}
                    title={atalho ? `${rotulo} (${atalho})` : rotulo}
                    className={`grid h-8 w-6 place-items-center text-stone-700 hover:bg-stone-50 disabled:opacity-40 sm:h-[30px] sm:w-8 ${k > 0 ? "border-l border-stone-300" : ""} ${ligado ? "bg-stone-200 text-stone-900 hover:bg-stone-200" : ""}`}
                  >
                    <Icone className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <div className="order-3 ml-auto flex items-center gap-1 sm:order-none sm:gap-2">
              <span role="status" aria-live="polite" className="mr-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                {salvando
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Salvando…</span></>
                  : estadoLarguras === "erro"
                    ? <span className="text-red-600">{erroLarguras}</span>
                    : <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">{ultimoSalvo === "larguras" ? "Larguras salvas" : "Alterações salvas"}</span></>}
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
          <div ref={folhaRef} className="folha">
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
                    <span className="capa-calha print:hidden" aria-hidden="true" />
                    <CelulaTexto key={tituloChave} valor={titulo} label="Título da lista" maxLength={200} onSalvar={salvarTitulo} />
                  </th>
                </tr>
                <tr>
                  {COLUNAS_LISTA.map((c, indice) => (
                    <th key={c.chave} scope="col">
                      {indice === 0 && <span className="capa-calha print:hidden" aria-hidden="true" />}
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
                      <td {...celula(item, "descricao")} className={`col-desc${item.descricao.length > LIMITE_DESCRICAO_LONGA ? " longa" : ""}${sufixoAtiva(item, "descricao")}`}>
                        {/* Calha de controles: fica à esquerda, fora das colunas da folha; nunca sai no papel */}
                        <span className="calha">
                          <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} aria-label={`Subir a linha ${n}`}>
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => mover(idx, 1)} disabled={idx === itens.length - 1} aria-label={`Descer a linha ${n}`}>
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button type="button" className="remover" onClick={() => setRemoverAlvo(item)} aria-label={`Remover a linha ${n}`}>
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                        <CelulaTexto formato={chaveEstilo(item.formatacao.descricao)} valor={item.descricao} label={`Descrição da linha ${n}`} onSalvar={(v) => salvarCampo(item, "descricao", v ?? "")} />
                      </td>
                      <td {...celula(item, "fabr")} className={`centro fab${sufixoAtiva(item, "fabr")}`}><CelulaTexto formato={chaveEstilo(item.formatacao.fabr)} opcional valor={item.fabricante} label={`Fabricante da linha ${n}`} onSalvar={(v) => salvarCampo(item, "fabricante", v)} /></td>
                      <td {...celula(item, "ref")} className={`centro${sufixoAtiva(item, "ref")}`}><CelulaTexto formato={chaveEstilo(item.formatacao.ref)} opcional valor={item.referencia} label={`Referência da linha ${n}`} onSalvar={(v) => salvarCampo(item, "referencia", v)} /></td>
                      <td {...celula(item, "vencto")} className={`centro${sufixoAtiva(item, "vencto")}`}><CelulaTexto formato={chaveEstilo(item.formatacao.vencto)} opcional valor={item.vencimento} label={`Vencimento da linha ${n}`} onSalvar={(v) => salvarCampo(item, "vencimento", v)} /></td>
                      <td {...celula(item, "qtd")} className={`centro num${sufixoAtiva(item, "qtd")}`}>
                        <div className="qtd-edit">
                          <CelulaNumero tipo="inteiro" valor={item.qtd_caixas} label={`Quantidade de caixas da linha ${n}`} onSalvar={(v) => v !== null && salvarCampo(item, "qtd_caixas", v)} />
                          <span aria-hidden="true" className="print:hidden">x</span>
                          <CelulaNumero tipo="inteiro" valor={item.unid_por_caixa} label={`Unidades por caixa da linha ${n}`} onSalvar={(v) => v !== null && salvarCampo(item, "unid_por_caixa", v)} />
                        </div>
                        <span className="so-papel qtd-papel">{item.qtd_caixas} &nbsp;x&nbsp; {item.unid_por_caixa}</span>
                      </td>
                      <td {...celula(item, "und")} className={`direita num${item.preco_unitario !== null && BRL.format(item.preco_unitario).length > 12 ? " apertada" : ""}${sufixoAtiva(item, "und")}`}>
                        <CelulaNumero tipo="preco" valor={item.preco_unitario} label={`Preço unitário da linha ${n}`} papel={item.preco_unitario === null ? "" : BRL.format(item.preco_unitario)} onSalvar={(v) => salvarCampo(item, "preco_unitario", v)} />
                      </td>
                      <Moeda valor={cx} {...celula(item, "cx")} ativa={eAtiva(item, "cx")} />
                      <Moeda valor={total} {...celula(item, "total")} ativa={eAtiva(item, "total")} />
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div ref={totalGeralRef} className="total-geral">{BRL.format(geral)}</div>

            <div className="aviso">
              <CelulaTexto multilinha valor={rodape} label="Aviso (rodapé da lista)" maxLength={1000} onSalvar={salvarRodape} />
            </div>

            <div className="rodape-empresa">
              {EMPRESA.linhasRodape.map((linha) => (
                <div key={linha}>{linha}</div>
              ))}
            </div>

            {/* Marcas de quebra de página: só na tela, posicionadas por cima (não mudam alturas nem larguras) */}
            {paginas.quebras.map((q) => (
              <div key={q.pagina} className="marca-pagina print:hidden" style={{ top: q.topo }} aria-hidden="true">
                <span>Página {q.pagina}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={medicaoRef} style={{ display: "contents" }}>
        <FolhaMedicao titulo={titulo} rodape={rodape} itens={itens} larguras={larguras} geral={geral} />
      </div>

      {removerAlvo && (
        <ConfirmDialog
          titulo="Remover linha?"
          mensagem={`Remover "${removerAlvo.descricao.trim() || "esta linha em branco"}" da lista de venda?`}
          confirmarLabel="Remover"
          destrutivo
          carregando={removendo}
          onConfirmar={confirmarRemocao}
          onCancelar={() => setRemoverAlvo(null)}
        />
      )}
    </div>
  )
}
