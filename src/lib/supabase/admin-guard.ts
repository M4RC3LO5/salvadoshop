import { createClient } from "@/lib/supabase/server"

// Guarda de API para rotas /api/admin/*: exige sessão e admin ativo (Master ou
// Auxiliar). Usa o client com a sessão do usuário — a RLS continua valendo.
export async function requireAdmin() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
        { status: 401 }
      ),
    }
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const, supabase, user, adminUser }
}

export function erroValidacao(message: string, status = 422) {
  return Response.json(
    { success: false, error: { code: "VALIDATION_ERROR", message } },
    { status }
  )
}

export function erroInterno(event: string, error: unknown, message: string) {
  console.error(JSON.stringify({ event, error }))
  return Response.json(
    { success: false, error: { code: "INTERNAL_ERROR", message } },
    { status: 500 }
  )
}
