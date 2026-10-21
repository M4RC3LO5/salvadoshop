// Quantos dias um produto esgotado continua aparecendo na vitrine.
export const DIAS_ESGOTADO_NA_VITRINE = 30

// Esgotado = produto individual (tipo_a) sem estoque. Lotes (tipo_b) não mudam.
export function estaEsgotado(tipo: string, estoque: number): boolean {
  return tipo === "tipo_a" && estoque <= 0
}
