import { z } from "zod"

// Remove as tags permitidas; se sobrar qualquer "<", há tag (ou atributo) não permitido.
const TAGS_PERMITIDAS = /<\/?(p|ul|li|strong)>/gi

// Dados extraídos pela IA, salvos em anuncios_ia.dados_ia.
//
// ATENÇÃO: "pedido" é dado INTERNO (custo de compra, origem do produto).
// NUNCA deve ir para o produto público — nem na descrição, nem nas especificações.
export const DadosAnuncioIa = z.object({
  nome: z.string().max(60).nullable(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  codigo: z.string().nullable(), // EAN, part number ou código do fabricante visível
  categoria_id: z.uuid().nullable(),
  especificacoes: z
    .array(
      z.object({
        nome: z.string(),
        valor: z.string(),
        origem: z.enum(["foto", "print_pedido"]),
      })
    )
    .max(30),
  conteudo_embalagem: z.array(z.string()).max(20),
  descricao_html: z
    .string()
    .max(3000)
    .refine((html) => !html.replace(TAGS_PERMITIDAS, "").includes("<"), {
      message: "Descrição só pode usar as tags p, ul, li e strong.",
    })
    .nullable(),
  nao_confirmado: z.array(z.string()).max(20),
  pedido: z
    .object({
      titulo_anuncio_origem: z.string().nullable(),
      valor_pago: z.number().nullable(),
      moeda: z.string().nullable(),
      quantidade: z.number().nullable(),
    })
    .nullable(),
})

export type DadosAnuncioIaTipo = z.infer<typeof DadosAnuncioIa>
