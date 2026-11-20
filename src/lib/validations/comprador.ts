import { z } from "zod"

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export const ORIGENS = ["carteira", "google", "indicacao", "grupo_marketplace"] as const
export const STATUS_COMPRADOR = ["lead", "contato", "cliente", "descartado"] as const
// O formulário nunca oferece "descartado".
export const STATUS_FORMULARIO = ["lead", "contato", "cliente"] as const

// Texto opcional: aparado; vazio vira null (os tamanhos seguem os checks da migration 043).
function textoOpcional(max: number, rotulo: string) {
  return z
    .string()
    .trim()
    .max(max, `${rotulo} pode ter no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null))
}

const camposComuns = {
  empresa: z
    .string({ error: "Informe o nome da empresa." })
    .trim()
    .min(1, "Informe o nome da empresa.")
    .max(200, "Empresa pode ter no máximo 200 caracteres."),
  pessoa_contato: textoOpcional(120, "Pessoa de contato"),
  telefone: textoOpcional(30, "Telefone"),
  celular: textoOpcional(30, "Celular"),
  celular_whatsapp: z.boolean().default(false),
  email: z
    .string()
    .trim()
    .max(200, "E-mail pode ter no máximo 200 caracteres.")
    .email("E-mail inválido.")
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  endereco: textoOpcional(300, "Endereço"),
  bairro: textoOpcional(120, "Bairro"),
  cidade: textoOpcional(120, "Cidade"),
  uf: z
    .enum(UFS, { message: "UF inválida." })
    .nullish()
    .transform((v) => v ?? null),
  site: textoOpcional(300, "Site"),
  observacao: textoOpcional(2000, "Observação"),
  status: z.enum(STATUS_FORMULARIO, { message: "Status inválido." }),
  segmentos: z
    .array(z.number().int().positive())
    .max(20, "Escolha no máximo 20 segmentos.")
    .default([]),
  // Reenvio após o aviso de duplicado
  forcar: z.boolean().optional(),
}

export const criarCompradorSchema = z.object({
  ...camposComuns,
  origem: z.enum(ORIGENS, { message: "Origem inválida." }),
})

// Origem não muda na edição; se vier no corpo, é ignorada.
export const atualizarCompradorSchema = z.object({
  ...camposComuns,
  // Comprador descartado mantém o status; aqui aceitamos qualquer valor e a rota decide.
  status: z.enum(STATUS_COMPRADOR, { message: "Status inválido." }),
})

export type CriarCompradorInput = z.infer<typeof criarCompradorSchema>
