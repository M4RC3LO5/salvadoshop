import type Anthropic from "@anthropic-ai/sdk"

export function montarSystemPrompt(categorias: { id: string; nome: string }[]): string {
  const listaCategorias = categorias.length
    ? categorias.map((c) => `- ${c.id} — ${c.nome}`).join("\n")
    : "(nenhuma categoria cadastrada)"

  return `Você monta rascunhos de anúncio para a loja SalvadoShop, que vende produtos salvados (de transportadoras, seguradoras e leilões) no Brasil. Você recebe fotos de um produto e, às vezes, prints da tela de compra do produto. Responda SEMPRE chamando a ferramenta "registrar_rascunho", em português do Brasil.

REGRAS:

a) Use SOMENTE informação visível nas imagens. Se algo não estiver visível ou legível, retorne null (ou lista vazia). NUNCA invente, estime ou complete com conhecimento próprio.

b) As imagens marcadas "Print do pedido" são a tela de compra (ex.: AliExpress). Delas extraia o objeto "pedido" (título do anúncio de origem, valor pago, moeda e quantidade) e use o título do anúncio de origem como pista para nome, modelo e especificações, marcando origem "print_pedido". Informações vindas das fotos do produto têm origem "foto". Se não houver print do pedido, "pedido" deve ser null.

c) nome: título comercial claro em português, com até 60 caracteres, sem emojis, sem palavras como "original", "garantia", "promoção" ou "frete grátis".

d) descricao_html: descrição comercial honesta em português, usando somente os fatos extraídos. Use apenas as tags <p>, <ul>, <li> e <strong>, sem atributos. Não afirme originalidade, garantia, homologação ou estado de conservação que não esteja visível nas imagens. Nunca mencione valor pago, preço de compra ou o pedido.

e) categoria_id: escolha uma das categorias abaixo (use exatamente o id) ou null se nenhuma servir.

Categorias:
${listaCategorias}

f) nao_confirmado: liste o que um vendedor normalmente informaria e não foi possível confirmar pelas imagens (ex.: voltagem, dimensões, cor, quantidade na embalagem).

g) codigo: somente se EAN, part number ou código do fabricante estiver legível; caso contrário null.

h) conteudo_embalagem: itens que aparecem na embalagem ou nas fotos; lista vazia se não for possível saber.`
}

const NULL_STR = { type: ["string", "null"] } as const

export const FERRAMENTA_RASCUNHO: Anthropic.Tool = {
  name: "registrar_rascunho",
  description: "Registra o rascunho do anúncio montado a partir das imagens.",
  input_schema: {
    type: "object",
    properties: {
      nome: { type: ["string", "null"], maxLength: 60, description: "Título do anúncio, até 60 caracteres." },
      marca: NULL_STR,
      modelo: NULL_STR,
      codigo: { ...NULL_STR, description: "EAN, part number ou código do fabricante visível." },
      categoria_id: { ...NULL_STR, description: "Id (uuid) de uma categoria da lista, ou null." },
      especificacoes: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            valor: { type: "string" },
            origem: { type: "string", enum: ["foto", "print_pedido"] },
          },
          required: ["nome", "valor", "origem"],
        },
      },
      conteudo_embalagem: { type: "array", maxItems: 20, items: { type: "string" } },
      descricao_html: {
        type: ["string", "null"],
        maxLength: 3000,
        description: "Somente as tags p, ul, li e strong, sem atributos.",
      },
      nao_confirmado: { type: "array", maxItems: 20, items: { type: "string" } },
      pedido: {
        type: ["object", "null"],
        properties: {
          titulo_anuncio_origem: NULL_STR,
          valor_pago: { type: ["number", "null"] },
          moeda: NULL_STR,
          quantidade: { type: ["number", "null"] },
        },
        required: ["titulo_anuncio_origem", "valor_pago", "moeda", "quantidade"],
      },
    },
    required: [
      "nome",
      "marca",
      "modelo",
      "codigo",
      "categoria_id",
      "especificacoes",
      "conteudo_embalagem",
      "descricao_html",
      "nao_confirmado",
      "pedido",
    ],
  },
}
