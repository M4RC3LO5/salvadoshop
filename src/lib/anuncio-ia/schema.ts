import { z } from "zod"

// Remove as tags permitidas; se sobrar qualquer "<", há tag (ou atributo) não permitido.
const TAGS_PERMITIDAS = /<\/?(p|ul|li|strong)>/gi

const TAG_QUALQUER = /(<[^<>]*>)/ // sem "<" dentro, para um "<" solto não engolir a tag seguinte
const TAG_PERMITIDA = /^<(\/?)(p|ul|li|strong)\s*>$/i

// Limpa o HTML da IA em vez de rejeitar: mantém só <p>, <ul>, <li> e <strong> (sem atributos),
// remove qualquer outra tag e escapa "<" solto. O refine de descricao_html segue como trava final.
export function sanitizarDescricao(html: string): string {
  return html
    .split(TAG_QUALQUER) // posições ímpares são tags; as pares, texto
    .map((parte, i) => {
      if (i % 2 === 0) return parte.replace(/</g, "&lt;")
      const m = TAG_PERMITIDA.exec(parte)
      return m ? `<${m[1]}${m[2].toLowerCase()}>` : ""
    })
    .join("")
    .trim()
}

// Dados extraídos pela IA, salvos em anuncios_ia.dados_ia.
//
// ATENÇÃO: "pedido" é dado INTERNO (custo de compra, origem do produto).
// NUNCA deve ir para o produto público — nem na descrição, nem nas especificações.
export const DadosAnuncioIa = z.object({
  nome: z.string().max(200).nullable(), // o limite de 60 é aplicado em processar.ts (encurta em vez de falhar)
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  codigo: z.string().nullable(), // EAN, part number ou código do fabricante visível
  categoria_id: z.uuid().nullable(),
  especificacoes: z
    .array(
      z.object({
        nome: z.string(),
        valor: z.string(),
        origem: z.enum(["foto", "print_pedido", "manual"]), // "manual" = adicionada pelo humano na revisão
      })
    )
    .max(40),
  conteudo_embalagem: z.array(z.string()).max(30),
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
