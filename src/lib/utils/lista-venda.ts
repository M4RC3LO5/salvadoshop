// Cálculos da Lista de Venda. Nada disto é gravado no banco: R$ Cx e R$ Total
// são sempre derivados de preco_unitario, unid_por_caixa e qtd_caixas.
// Trabalha em centavos inteiros para evitar erro de ponto flutuante.

export interface ItemCalculavel {
  qtd_caixas: number
  unid_por_caixa: number
  preco_unitario: number | null
}

// R$ Cx = preço unitário × unidades por caixa (null se faltar preço)
export function precoCaixa(item: ItemCalculavel): number | null {
  if (item.preco_unitario === null) return null
  return Math.round(Math.round(item.preco_unitario * 100) * item.unid_por_caixa) / 100
}

// R$ Total = R$ Cx × quantidade de caixas (null se faltar preço)
export function totalItem(item: ItemCalculavel): number | null {
  const cx = precoCaixa(item)
  if (cx === null) return null
  return Math.round(cx * 100 * item.qtd_caixas) / 100
}

// Total geral: soma só os itens que já têm preço
export function totalGeral(itens: ItemCalculavel[]): number {
  const centavos = itens.reduce((acc, i) => {
    const t = totalItem(i)
    return acc + (t === null ? 0 : Math.round(t * 100))
  }, 0)
  return centavos / 100
}
