// Modelo e preços usados no "Anúncio por fotos".
// Fonte dos preços: tabela oficial de preços da Anthropic (consultada em out/2026),
// em US$ por milhão de tokens. Se o modelo ou a tabela mudarem, atualizar aqui.
export const MODELO = "claude-sonnet-4-6"
export const PRECO_ENTRADA_USD_POR_MTOK = 3
export const PRECO_SAIDA_USD_POR_MTOK = 15

// Custo em US$, arredondado para 6 casas (coluna anuncios_ia.custo_usd é numeric(10,6)).
export function calcularCustoUsd(tokensEntrada: number, tokensSaida: number): number {
  const custo =
    (tokensEntrada * PRECO_ENTRADA_USD_POR_MTOK + tokensSaida * PRECO_SAIDA_USD_POR_MTOK) / 1_000_000
  return Math.round(custo * 1_000_000) / 1_000_000
}
