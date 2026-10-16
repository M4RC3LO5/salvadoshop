import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"

const patchSchema = z.object({
  titulo: z.string().trim().min(1, "O título é obrigatório.").max(200).optional(),
  rodape: z.string().max(1000).optional(),
}).strict()

const idSchema = z.string().uuid()

// PATCH — edição do título/rodapé (um campo por vez, como na triagem)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success) return erroValidacao("ID inválido.", 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Body inválido.", 400)
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos.")
  if (Object.keys(parsed.data).length === 0) return erroValidacao("Nada para atualizar.")

  const { data, error } = await guard.supabase
    .from("listas_venda")
    .update(parsed.data)
    .eq("id", params.id)
    .select("id")
    .maybeSingle()

  if (error) return erroInterno("listas_venda.patch.error", error, "Erro ao salvar a alteração.")
  if (!data) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Lista não encontrada." } },
      { status: 404 }
    )
  }
  return Response.json({ success: true })
}

// DELETE — exclui a lista (itens saem em cascata no banco)
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success) return erroValidacao("ID inválido.", 400)

  const { error } = await guard.supabase.from("listas_venda").delete().eq("id", params.id)
  if (error) return erroInterno("listas_venda.delete.error", error, "Erro ao excluir a lista.")

  console.log(JSON.stringify({
    event: "listas_venda.excluida",
    lista_venda_id: params.id,
    admin_id: guard.adminUser.id,
    timestamp: new Date().toISOString(),
  }))
  return Response.json({ success: true })
}
