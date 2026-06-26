import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const novoUsuarioSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["master", "auxiliar"]),
})

function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.")
  }
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET() {
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
    .select("role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem gerenciar usuários." } },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from("admin_usuarios")
    .select("id, user_id, nome, email, role, ativo, created_at")
    .order("created_at", { ascending: true })

  if (error) {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao buscar usuários." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data })
}

export async function POST(request: NextRequest) {
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
    .select("role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem criar usuários." } },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = novoUsuarioSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Dados inválidos.", details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const { nome, email, role } = parsed.data
  const senhaTmp = "SalvadoTemp2026!"

  let adminSupabase: ReturnType<typeof criarClienteAdmin>
  try {
    adminSupabase = criarClienteAdmin()
  } catch {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Configuração do servidor incompleta. Adicione SUPABASE_SERVICE_ROLE_KEY ao .env.local." } },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: senhaTmp,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error("[usuarios/POST] authError:", authError)
    const msg = authError?.message?.includes("already registered")
      ? "Este e-mail já está cadastrado."
      : `Erro ao criar usuário: ${authError?.message ?? "desconhecido"}`
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: msg } },
      { status: 400 }
    )
  }

  const { error: dbError } = await supabase
    .from("admin_usuarios")
    .insert({ user_id: authData.user.id, nome, email, role, ativo: true })

  if (dbError) {
    // Rollback: remove o usuário do Auth
    await adminSupabase.auth.admin.deleteUser(authData.user.id)
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao salvar usuário no banco." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: { senhaTmp } }, { status: 201 })
}
