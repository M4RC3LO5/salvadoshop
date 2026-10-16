import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"

const idSchema = z.string().uuid()

// Campos editáveis (um por vez, como na triagem). estoque_item_id e ordem
// não passam por aqui — ordem tem rota própria.
const patchSchema = z.object({
  descricao: z.string().max(500).optional(),
  fabricante: z.string().max(200).nullable().optional(),
  referencia: z.string().max(200).nullable().optional(),
  vencimento: z.string().max(50).nullable().optional(),
  qtd_caixas: z.number().int().min(0, "Quantidade de caixas não pode ser negativa.").max(1_000_000).optional(),
  unid_por_caixa: z.number().int().min(1, "Unidades por caixa deve ser ao menos 1.").max(1_000_000).optional(),
  preco_unitario: z.number().min(0, "O preço não pode ser negativo.").max(99_999_999).nullable().optional(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success || !idSchema.safeParse(params.itemId).success) {
    return erroValidacao("ID inválido.", 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Body inválido.", 400)
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos.")
  if (Object.keys(parsed.data).length !== 1) return erroValidacao("Envie exatamente um campo por vez.")

  const { data, error } = await guard.supabase
    .from("listas_venda_itens")
    .update(parsed.data)
    .eq("id", params.itemId)
    .eq("lista_venda_id", params.id)
    .select("id")
    .maybeSingle()

  if (error) return erroInterno("listas_venda.itens.patch.error", error, "Erro ao salvar a alteração.")
  if (!data) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Item não encontrado." } },
      { status: 404 }
    )
  }
  return Response.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success || !idSchema.safeParse(params.itemId).success) {
    return erroValidacao("ID inválido.", 400)
  }

  const { error } = await guard.supabase
    .from("listas_venda_itens")
    .delete()
    .eq("id", params.itemId)
    .eq("lista_venda_id", params.id)

  if (error) return erroInterno("listas_venda.itens.delete.error", error, "Erro ao remover o item.")
  return Response.json({ success: true })
}
