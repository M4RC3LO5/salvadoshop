import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const patchSchema = z.object({
  role: z.enum(["master", "auxiliar"]).optional(),
  ativo: z.boolean().optional(),
}).refine((d) => d.role !== undefined || d.ativo !== undefined, {
  message: "Informe role ou ativo.",
})

function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.")
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getMasterUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, adminUser: null }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id, user_id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  return { user, adminUser }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { user, adminUser } = await getMasterUser(supabase)

  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem editar usuários." } },
      { status: 403 }
    )
  }

  // Busca o alvo
  const { data: alvo } = await supabase
    .from("admin_usuarios")
    .select("id, user_id, role, ativo")
    .eq("id", params.id)
    .single()

  if (!alvo) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Usuário não encontrado." } },
      { status: 404 }
    )
  }

  // Master não pode alterar a si mesmo
  if (alvo.user_id === user.id) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Você não pode alterar seu próprio usuário." } },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Dados inválidos.", details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.role !== undefined) updates.role = parsed.data.role
  if (parsed.data.ativo !== undefined) updates.ativo = parsed.data.ativo

  const { error } = await supabase
    .from("admin_usuarios")
    .update(updates)
    .eq("id", params.id)

  if (error) {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar usuário." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { user, adminUser } = await getMasterUser(supabase)

  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem excluir usuários." } },
      { status: 403 }
    )
  }

  // Busca o alvo
  const { data: alvo } = await supabase
    .from("admin_usuarios")
    .select("id, user_id, ativo")
    .eq("id", params.id)
    .single()

  if (!alvo) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Usuário não encontrado." } },
      { status: 404 }
    )
  }

  if (alvo.user_id === user.id) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Você não pode excluir seu próprio usuário." } },
      { status: 403 }
    )
  }

  if (alvo.ativo) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Desative o usuário antes de excluir." } },
      { status: 403 }
    )
  }

  // Remove do banco primeiro
  const { error: dbError } = await supabase
    .from("admin_usuarios")
    .delete()
    .eq("id", params.id)

  if (dbError) {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao excluir usuário." } },
      { status: 500 }
    )
  }

  // Remove do Auth
  const adminSupabase = criarClienteAdmin()
  await adminSupabase.auth.admin.deleteUser(alvo.user_id)

  return Response.json({ success: true })
}
