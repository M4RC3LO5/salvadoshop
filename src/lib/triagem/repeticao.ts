// Detecção de item repetido na lista de triagem (função pura).
// Chave: SKU; sem SKU, EAN; sem nenhum dos dois, não verifica.

export interface ItemRepeticao {
  id: string
  ordem: number
  nome: string
  sku: string | null
  ean: string | null
  validade: string | null
  lote: string | null
  qtd_embalagem: number
  num_caixas: number
}

export interface CandidatoRepeticao {
  sku: string
  ean: string
  validade: string
  lote: string
  qtd_embalagem: number
}

function normalizarTexto(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim().toUpperCase()
  return t === "" ? null : t
}

function normalizarCodigo(valor: string | null | undefined): string | null {
  const t = normalizarTexto(valor)
  return t === null ? null : t.replace(/\s+/g, "")
}

function normalizarValidade(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

export function encontrarRepeticoes(
  candidato: CandidatoRepeticao,
  itens: ItemRepeticao[]
): { iguais: ItemRepeticao[]; parecidos: ItemRepeticao[]; chave: "sku" | "ean" | null } {
  const sku = normalizarCodigo(candidato.sku)
  const ean = normalizarCodigo(candidato.ean)
  const usaSku = sku !== null
  const valorChave = usaSku ? sku : ean

  if (valorChave === null) return { iguais: [], parecidos: [], chave: null }

  const validade = normalizarValidade(candidato.validade)
  const lote = normalizarTexto(candidato.lote)
  const qtd = candidato.qtd_embalagem

  const iguais: ItemRepeticao[] = []
  const parecidos: ItemRepeticao[] = []

  for (const item of itens) {
    const chaveItem = usaSku ? normalizarCodigo(item.sku) : normalizarCodigo(item.ean)
    if (chaveItem !== valorChave) continue

    const igual =
      normalizarValidade(item.validade) === validade &&
      normalizarTexto(item.lote) === lote &&
      item.qtd_embalagem === qtd

    ;(igual ? iguais : parecidos).push(item)
  }

  const porOrdem = (a: ItemRepeticao, b: ItemRepeticao) => a.ordem - b.ordem
  return {
    iguais: iguais.sort(porOrdem),
    parecidos: parecidos.sort(porOrdem),
    chave: usaSku ? "sku" : "ean",
  }
}
