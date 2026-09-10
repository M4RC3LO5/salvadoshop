// Percentual de diferença entre o preço no site e no Mercado Livre — sempre
// calculado a partir dos dois preços reais, nunca premissa fixa. Retorna
// null quando não há economia real (ML menor ou igual ao site) ou quando
// falta algum dos dois preços — nesses casos a UI deve mostrar só o preço
// do site, sem badge nem preço riscado.
export interface ComparativoPreco {
  economia: number
  percentual: number
}

export function calcularComparativoPreco(
  precoML: number | null | undefined,
  precoSite: number | null | undefined
): ComparativoPreco | null {
  if (!precoML || !precoSite || precoML <= precoSite) return null
  const economia = precoML - precoSite
  const percentual = (economia / precoML) * 100
  return { economia, percentual }
}
