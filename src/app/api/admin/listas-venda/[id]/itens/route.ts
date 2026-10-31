import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"

const idSchema = z.string().uuid()

const COLUNAS_ITEM =
  "id, ordem, descricao, fabricante, referencia, vencimento, qtd_caixas, unid_por_caixa, preco_unitario, formatacao"

// POST — adiciona uma linha manual em branco ao final da lista
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success) return erroValidacao("ID inválido.", 400)

  const { data: ultimo, error: erroOrdem } = await guard.supabase
    .from("listas_venda_itens")
    .select("ordem")
    .eq("lista_venda_id", params.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (erroOrdem) return erroInterno("listas_venda.itens.post.ordem.error", erroOrdem, "Erro ao adicionar a linha.")

  const { data, error } = await guard.supabase
    .from("listas_venda_itens")
    .insert({
      lista_venda_id: params.id,
      ordem: (ultimo?.ordem ?? 0) + 1,
      descricao: "",
      qtd_caixas: 1,
      unid_por_caixa: 1,
      preco_unitario: null,
    })
    .select(COLUNAS_ITEM)
    .single()

  if (error || !data) return erroInterno("listas_venda.itens.post.error", error, "Erro ao adicionar a linha.")
  return Response.json({ success: true, data }, { status: 201 })
}
