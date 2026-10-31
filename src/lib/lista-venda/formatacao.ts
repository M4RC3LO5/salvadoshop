// Formatação por CÉLULA da Lista de Venda (negrito, itálico, sublinhado, tachado).
// Vale para a célula inteira, não para um trecho do texto. É guardada em
// listas_venda_itens.formatacao (jsonb), ex.: {"descricao": {"n": true, "t": true}}.
// Compartilhado entre o editor (tela, papel e medição) e o xlsx.

import type { CSSProperties } from "react"
import { COLUNAS_LISTA, type ChaveColuna } from "./larguras"

export type EstiloChave = "n" | "i" | "s" | "t"
export type EstiloCelula = Partial<Record<EstiloChave, boolean>>
export type FormatacaoItem = Partial<Record<ChaveColuna, EstiloCelula>>

export const ESTILOS: { chave: EstiloChave; rotulo: string; atalho?: string }[] = [
  { chave: "n", rotulo: "Negrito", atalho: "Ctrl+B" },
  { chave: "i", rotulo: "Itálico", atalho: "Ctrl+I" },
  { chave: "s", rotulo: "Sublinhado", atalho: "Ctrl+U" },
  { chave: "t", rotulo: "Tachado" },
]

// Aceita o valor cru do banco (jsonb) e devolve só chaves e estilos conhecidos, com valor true.
export function normalizarFormatacao(cru: unknown): FormatacaoItem {
  const resultado: FormatacaoItem = {}
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return resultado
  const obj = cru as Record<string, unknown>
  for (const { chave } of COLUNAS_LISTA) {
    const est = obj[chave]
    if (!est || typeof est !== "object" || Array.isArray(est)) continue
    const e = est as Record<string, unknown>
    const limpo: EstiloCelula = {}
    for (const { chave: k } of ESTILOS) if (e[k] === true) limpo[k] = true
    if (Object.keys(limpo).length > 0) resultado[chave] = limpo
  }
  return resultado
}

// Liga/desliga um estilo numa célula. Devolve um objeto novo, sem células ou estilos vazios.
export function alternarEstilo(formatacao: FormatacaoItem, coluna: ChaveColuna, estilo: EstiloChave): FormatacaoItem {
  const atual = { ...(formatacao[coluna] ?? {}) }
  if (atual[estilo]) delete atual[estilo]
  else atual[estilo] = true
  const proximo: FormatacaoItem = { ...formatacao }
  if (Object.keys(atual).length > 0) proximo[coluna] = atual
  else delete proximo[coluna]
  return proximo
}

// Estilo CSS da célula (<td>). Fica no td para valer no campo de edição, no texto do papel
// (.so-papel) e na cópia de medição; sublinhado e tachado se combinam.
export function estiloCss(est?: EstiloCelula): CSSProperties | undefined {
  if (!est) return undefined
  const decoracao = [est.s && "underline", est.t && "line-through"].filter(Boolean).join(" ")
  const css: CSSProperties = {}
  if (est.n) css.fontWeight = 700
  if (est.i) css.fontStyle = "italic"
  if (decoracao) css.textDecoration = decoracao
  return Object.keys(css).length > 0 ? css : undefined
}

// Texto curto que muda quando o estilo muda (dependência para remedir a altura do campo).
export function chaveEstilo(est?: EstiloCelula): string {
  return ESTILOS.map(({ chave }) => (est?.[chave] ? chave : "")).join("")
}
