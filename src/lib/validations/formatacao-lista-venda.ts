import { z } from "zod"

// Formatação por célula da Lista de Venda (ver lib/lista-venda/formatacao.ts).
// As chaves são as de COLUNAS_LISTA (lib/lista-venda/larguras.ts); strict rejeita qualquer chave desconhecida.
const estiloCelula = z
  .object({
    n: z.boolean().optional(),
    i: z.boolean().optional(),
    s: z.boolean().optional(),
    t: z.boolean().optional(),
  })
  .strict()

export const formatacaoSchema = z
  .object({
    descricao: estiloCelula.optional(),
    fabr: estiloCelula.optional(),
    ref: estiloCelula.optional(),
    vencto: estiloCelula.optional(),
    qtd: estiloCelula.optional(),
    und: estiloCelula.optional(),
    cx: estiloCelula.optional(),
    total: estiloCelula.optional(),
  })
  .strict()
