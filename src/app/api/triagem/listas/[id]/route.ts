import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const patchSchema = z.object({
  nome: z.string().min(1, "Nome da lista é obrigatório."),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Body inválido." } },
      { status: 400 }
    )
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from("triagem_listas")
    .update({ nome: parsed.data.nome, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, nome")
    .single()

  if (error || !data) {
    console.error(JSON.stringify({ event: "triagem.listas.patch.error", error, lista_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao renomear a lista." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data })
}

// ── DELETE — excluir lista vazia ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  const { count, error: countError } = await supabase
    .from("estoque_itens")
    .select("id", { count: "exact", head: true })
    .eq("lista_id", params.id)

  if (countError) {
    console.error(JSON.stringify({ event: "triagem.listas.delete.count.error", error: countError, lista_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao verificar os itens da lista." } },
      { status: 500 }
    )
  }

  if ((count ?? 0) > 0) {
    return Response.json(
      { success: false, error: { code: "CONFLICT", message: "A lista ainda tem itens. Mova ou exclua os itens antes de excluir a lista." } },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from("triagem_listas")
    .delete()
    .eq("id", params.id)

  if (error) {
    console.error(JSON.stringify({ event: "triagem.listas.delete.error", error, lista_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao excluir a lista." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
