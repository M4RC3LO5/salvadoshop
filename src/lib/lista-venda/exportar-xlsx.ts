// Exporta a Lista de Venda para .xlsx no mesmo layout da impressão (logo,
// título, tabela, total, aviso e rodapé da empresa). R$ Cx, R$ Total e o total
// geral são FÓRMULAS: se o preço ou a quantidade mudarem no Excel, tudo recalcula.
// Roda só no navegador (importado dinamicamente pelo editor).

import { precoCaixa, totalGeral, totalItem, type ItemCalculavel } from "@/lib/utils/lista-venda"
import { COR_CABECALHO, EMPRESA, LIMITE_DESCRICAO_LONGA } from "@/lib/lista-venda/empresa"

export interface ItemExportavel extends ItemCalculavel {
  descricao: string
  fabricante: string | null
  referencia: string | null
  vencimento: string | null
}

const PRIMEIRA_LINHA_DADOS = 8
const LINHA_TITULO = 6
const LINHA_CABECALHO = 7
const MOEDA = '"R$" #,##0.00'

function nomeArquivoSeguro(titulo: string): string {
  const limpo = titulo.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()
  return `${limpo || "lista-de-venda"}.xlsx`
}

async function logoBase64(): Promise<string | null> {
  try {
    const res = await fetch(EMPRESA.logoPublicPath)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ""
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
    }
    return btoa(bin)
  } catch {
    return null
  }
}

export async function gerarXlsxListaVenda(dados: {
  titulo: string
  rodape: string
  itens: ItemExportavel[]
}): Promise<{ blob: Blob; nomeArquivo: string }> {
  const { default: ExcelJS } = await import("exceljs")
  const { titulo, rodape, itens } = dados

  const wb = new ExcelJS.Workbook()
  wb.creator = "Comercial Dantas"
  const ws = wb.addWorksheet("Lista de Venda", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.3 },
      printTitlesRow: `${LINHA_TITULO}:${LINHA_CABECALHO}`,
    },
  })

  // A Descrição | B Fabr. | C Ref. | D Vencto | E caixas | F "x" | G unid | H R$ UND | I R$ Cx | J R$ Total
  ws.columns = [
    { width: 50 }, { width: 14 }, { width: 10 }, { width: 10 },
    { width: 5.5 }, { width: 3 }, { width: 5.5 },
    { width: 11 }, { width: 12 }, { width: 14 },
  ]

  // ── Logo (linhas 1 a 5) ──
  for (let r = 1; r <= 5; r++) ws.getRow(r).height = 17
  const base64 = await logoBase64()
  if (base64) {
    const idLogo = wb.addImage({ base64, extension: "png" })
    const largura = 380
    ws.addImage(idLogo, {
      tl: { col: 0.05, row: 0.2 },
      ext: { width: largura, height: Math.round((largura * EMPRESA.logoAltura) / EMPRESA.logoLargura) },
    })
  }

  const azul = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: `FF${COR_CABECALHO}` } }
  const preta = { style: "thin" as const, color: { argb: "FF000000" } }
  const cinza = { style: "thin" as const, color: { argb: "FF9A9A9A" } }

  // ── Título ──
  ws.mergeCells(LINHA_TITULO, 1, LINHA_TITULO, 10)
  const tituloCell = ws.getCell(LINHA_TITULO, 1)
  tituloCell.value = titulo
  tituloCell.font = { name: "Arial Black", size: 10, underline: true }
  tituloCell.alignment = { horizontal: "center", vertical: "middle" }
  for (let c = 1; c <= 10; c++) {
    const cell = ws.getCell(LINHA_TITULO, c)
    cell.fill = azul
    cell.border = { top: preta, left: preta, right: preta, bottom: preta }
  }

  // ── Cabeçalho ──
  ws.mergeCells(LINHA_CABECALHO, 5, LINHA_CABECALHO, 7)
  const rotulos: Record<number, string> = { 1: "Descrição", 2: "Fabr.", 3: "Ref.", 4: "Vencto", 5: "Qtd", 8: "R$ UND", 9: "R$ Cx", 10: "R$ Total" }
  for (let c = 1; c <= 10; c++) {
    const cell = ws.getCell(LINHA_CABECALHO, c)
    if (rotulos[c]) cell.value = rotulos[c]
    cell.font = { name: "Arial Black", size: 10 }
    cell.fill = azul
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = { top: preta, left: preta, right: preta, bottom: preta }
  }
  ws.getRow(LINHA_CABECALHO).height = 18

  // ── Itens ──
  itens.forEach((item, idx) => {
    const r = PRIMEIRA_LINHA_DADOS + idx
    const row = ws.getRow(r)
    row.height = 21

    const cx = precoCaixa(item)
    const total = totalItem(item)
    const temPreco = item.preco_unitario !== null

    ws.getCell(r, 1).value = item.descricao
    ws.getCell(r, 2).value = item.fabricante ?? ""
    ws.getCell(r, 3).value = item.referencia ?? ""
    ws.getCell(r, 4).value = item.vencimento ?? ""
    ws.getCell(r, 5).value = item.qtd_caixas
    ws.getCell(r, 6).value = "x"
    ws.getCell(r, 7).value = item.unid_por_caixa
    ws.getCell(r, 8).value = temPreco ? item.preco_unitario : null
    // Fórmulas com o resultado em cache (visualizadores que não recalculam também mostram o valor)
    ws.getCell(r, 9).value = { formula: `IF(H${r}="","",ROUND(H${r}*G${r},2))`, result: cx ?? "" }
    ws.getCell(r, 10).value = { formula: `IF(H${r}="","",ROUND(I${r}*E${r},2))`, result: total ?? "" }

    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c)
      const longa = c === 1 && item.descricao.length > LIMITE_DESCRICAO_LONGA
      cell.font = { name: "Calibri", size: longa ? 8 : 10 }
      cell.border = { top: cinza, bottom: cinza, left: preta, right: preta }
      cell.alignment = {
        vertical: "bottom",
        horizontal: c === 1 || c >= 8 ? "left" : "center",
        wrapText: c === 1,
      }
    }
    ws.getCell(r, 5).alignment = { vertical: "bottom", horizontal: "right" }
    ws.getCell(r, 6).alignment = { vertical: "bottom", horizontal: "center" }
    ws.getCell(r, 7).alignment = { vertical: "bottom", horizontal: "left" }
    for (const c of [8, 9, 10]) ws.getCell(r, c).numFmt = MOEDA
  })

  const ultimaLinha = PRIMEIRA_LINHA_DADOS + itens.length - 1
  // Fecha a tabela com a linha preta na base
  const linhaFecho = Math.max(ultimaLinha, LINHA_CABECALHO)
  for (let c = 1; c <= 10; c++) {
    const cell = ws.getCell(linhaFecho, c)
    cell.border = { ...cell.border, bottom: preta }
  }

  // ── Total geral (soma automática da coluna R$ Total) ──
  const linhaTotal = linhaFecho + 1
  const totalCell = ws.getCell(linhaTotal, 10)
  totalCell.value = itens.length > 0
    ? { formula: `SUM(J${PRIMEIRA_LINHA_DADOS}:J${ultimaLinha})`, result: totalGeral(itens) }
    : 0
  totalCell.numFmt = MOEDA
  totalCell.font = { name: "Calibri", size: 10.5, bold: true }
  totalCell.alignment = { horizontal: "left" }

  // ── Aviso e rodapé da empresa ──
  const linhaAviso = linhaTotal + 2
  ws.mergeCells(linhaAviso, 1, linhaAviso, 10)
  const avisoCell = ws.getCell(linhaAviso, 1)
  avisoCell.value = rodape
  avisoCell.font = { name: "Arial", size: 11, bold: true, italic: true, underline: true }
  avisoCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  ws.getRow(linhaAviso).height = Math.max(20, 16 * Math.ceil(rodape.length / 90))

  EMPRESA.linhasRodape.forEach((linha, i) => {
    const r = linhaAviso + 3 + i
    ws.mergeCells(r, 1, r, 10)
    const cell = ws.getCell(r, 1)
    cell.value = linha
    cell.font = { name: "Arial", size: 9 }
    cell.alignment = { horizontal: "center" }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  return { blob, nomeArquivo: nomeArquivoSeguro(titulo) }
}
