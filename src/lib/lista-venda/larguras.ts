// Largura das colunas da Lista de Venda, em PORCENTAGEM da largura da tabela.
// Compartilhado entre a tela de impressão e o xlsx. A coluna do banco
// (listas_venda.larguras_colunas) guarda esse objeto; NULL = padrão daqui.

export const COLUNAS_LISTA = [
  { chave: "descricao", rotulo: "Descrição", minimo: 12 },
  { chave: "fabr", rotulo: "Fabr.", minimo: 8 },
  { chave: "ref", rotulo: "Ref.", minimo: 5 },
  { chave: "vencto", rotulo: "Vencto", minimo: 6 },
  { chave: "qtd", rotulo: "Qtd", minimo: 6 },
  { chave: "und", rotulo: "R$ UND", minimo: 6 },
  { chave: "cx", rotulo: "R$ Cx", minimo: 6 },
  { chave: "total", rotulo: "R$ Total", minimo: 7 },
] as const

export type ChaveColuna = (typeof COLUNAS_LISTA)[number]["chave"]
export type LargurasColunas = Record<ChaveColuna, number>

// Padrão pensado para fabricante de até ~20 caracteres em 1 linha e para listas
// longas (150+ itens) ocuparem poucas páginas.
export const LARGURAS_PADRAO: LargurasColunas = {
  descricao: 33,
  fabr: 17.5,
  ref: 7.5,
  vencto: 7.5,
  qtd: 7,
  und: 8,
  cx: 8.5,
  total: 11,
}

export const MAXIMO_COLUNA = 60
// Tolerância da soma (arredondamento de casas decimais)
export const TOLERANCIA_SOMA = 0.5

export function somaLarguras(l: LargurasColunas): number {
  return COLUNAS_LISTA.reduce((acc, c) => acc + l[c.chave], 0)
}

// Aceita o valor cru do banco (jsonb) e devolve larguras válidas; qualquer
// coisa fora do esperado cai no padrão em vez de quebrar a impressão.
export function normalizarLarguras(cru: unknown): LargurasColunas {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return { ...LARGURAS_PADRAO }
  const obj = cru as Record<string, unknown>
  const resultado = {} as LargurasColunas
  for (const c of COLUNAS_LISTA) {
    const v = obj[c.chave]
    if (typeof v !== "number" || !Number.isFinite(v) || v < c.minimo || v > MAXIMO_COLUNA) {
      return { ...LARGURAS_PADRAO }
    }
    resultado[c.chave] = v
  }
  if (Math.abs(somaLarguras(resultado) - 100) > TOLERANCIA_SOMA) return { ...LARGURAS_PADRAO }
  return resultado
}

// Move a borda direita da coluna `indice` em `deltaPct` pontos percentuais: a
// coluna cresce/encolhe e a vizinha da direita compensa, então a soma continua
// 100 e cada coluna respeita o seu mínimo.
export function redimensionar(base: LargurasColunas, indice: number, deltaPct: number): LargurasColunas {
  const esq = COLUNAS_LISTA[indice]
  const dir = COLUNAS_LISTA[indice + 1]
  if (!esq || !dir) return base
  const maxEncolher = base[esq.chave] - esq.minimo
  const maxCrescer = base[dir.chave] - dir.minimo
  const delta = Math.min(Math.max(deltaPct, -maxEncolher), maxCrescer)
  const novaEsq = Math.round((base[esq.chave] + delta) * 10) / 10
  const novaDir = Math.round((base[esq.chave] + base[dir.chave] - novaEsq) * 10) / 10
  return { ...base, [esq.chave]: novaEsq, [dir.chave]: novaDir }
}
