import { z } from "zod"
import { COLUNAS_LISTA, MAXIMO_COLUNA, TOLERANCIA_SOMA, somaLarguras, type LargurasColunas } from "@/lib/lista-venda/larguras"

// Valida o objeto de larguras vindo do cliente: as 8 chaves (e só elas),
// cada uma entre o mínimo e o máximo, somando ~100%.
const campo = (minimo: number) => z.number().finite().min(minimo).max(MAXIMO_COLUNA)

export const largurasColunasSchema = z
  .object({
    descricao: campo(COLUNAS_LISTA[0].minimo),
    fabr: campo(COLUNAS_LISTA[1].minimo),
    ref: campo(COLUNAS_LISTA[2].minimo),
    vencto: campo(COLUNAS_LISTA[3].minimo),
    qtd: campo(COLUNAS_LISTA[4].minimo),
    und: campo(COLUNAS_LISTA[5].minimo),
    cx: campo(COLUNAS_LISTA[6].minimo),
    total: campo(COLUNAS_LISTA[7].minimo),
  })
  .strict()
  .refine((l) => Math.abs(somaLarguras(l as LargurasColunas) - 100) <= TOLERANCIA_SOMA, {
    message: "As larguras das colunas devem somar 100%.",
  })
