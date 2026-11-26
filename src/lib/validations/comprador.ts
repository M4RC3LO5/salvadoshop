import { z } from "zod"
import {
  MSG_CELULAR,
  MSG_TELEFONE,
  formatarTelefone,
  type TipoTelefone,
} from "@/lib/compradores/telefone"

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

// Telefone/celular: vazio vira null; preenchido precisa ser válido e é gravado já formatado.
function telefoneOpcional(tipo: TipoTelefone) {
  return z
    .string()
    .trim()
    .max(30, tipo === "celular" ? MSG_CELULAR : MSG_TELEFONE)
    .nullish()
    .transform((v, ctx) => {
      if (!v) return null
      const formatado = formatarTelefone(v, tipo)
      if (!formatado) {
        ctx.issues.push({ code: "custom", message: tipo === "celular" ? MSG_CELULAR : MSG_TELEFONE, input: v })
        return z.NEVER
      }
      return formatado
    })
}

const camposComuns = {
  empresa: z
    .string({ error: "Informe o nome da empresa." })
    .trim()
    .min(1, "Informe o nome da empresa.")
    .max(200, "Empresa pode ter no máximo 200 caracteres."),
  pessoa_contato: textoOpcional(120, "Pessoa de contato"),
  telefone: telefoneOpcional("telefone"),
  celular: telefoneOpcional("celular"),
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
