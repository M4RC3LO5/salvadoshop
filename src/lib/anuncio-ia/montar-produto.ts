// Função pura: converte os dados revisados de um anúncio por fotos no rascunho
// usado para preencher o formulário de Novo Produto.
//
// ATENÇÃO: dados.pedido (custo de compra, origem) e dados.nao_confirmado são
// INTERNOS e NUNCA entram no produto público. Os prints do pedido também não:
// só as imagens de tipo "foto" são aproveitadas.

export interface DadosParaProduto {
  nome?: string | null
  marca?: string | null
  modelo?: string | null
  codigo?: string | null
  categoria_id?: string | null
  especificacoes?: { nome: string; valor: string }[] | null
  conteudo_embalagem?: string[] | null
  descricao_html?: string | null
}

export interface ImagemAnuncio {
  url?: string
  public_id?: string
  tipo?: string
}

export interface RascunhoProduto {
  nome: string
  specs: string
  descricao: string
  categoria_id: string | null
  imagens: { url: string; public_id: string }[]
}

export function montarRascunhoProduto(dados: DadosParaProduto, imagens: ImagemAnuncio[]): RascunhoProduto {
  const linhas: string[] = []
  if (dados.marca?.trim()) linhas.push(`Marca: ${dados.marca.trim()}`)
  if (dados.modelo?.trim()) linhas.push(`Modelo: ${dados.modelo.trim()}`)
  if (dados.codigo?.trim()) linhas.push(`Código: ${dados.codigo.trim()}`)
  for (const e of dados.especificacoes ?? []) {
    linhas.push(`${e.nome}: ${e.valor}`)
  }

  const embalagem = (dados.conteudo_embalagem ?? []).filter((i) => i.trim())
  if (embalagem.length > 0) {
    linhas.push("", "Conteúdo da embalagem:", ...embalagem.map((i) => `- ${i.trim()}`))
  }

  return {
    nome: dados.nome ?? "",
    specs: linhas.join("\n"),
    descricao: dados.descricao_html ?? "",
    categoria_id: dados.categoria_id ?? null,
    imagens: imagens
      .filter((i) => i.tipo === "foto" && typeof i.url === "string" && typeof i.public_id === "string")
      .map((i) => ({ url: i.url as string, public_id: i.public_id as string })),
  }
}
