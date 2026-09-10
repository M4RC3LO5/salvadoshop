import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/utils/slugify"

// ── GET — lista categorias (qualquer admin ativo) ───────────────────────────

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

  const { data: categorias, error } = await supabase
    .from("categorias")
    .select("id, nome")
    .order("nome")

  if (error) {
    console.error(JSON.stringify({ event: "categorias.list.error", error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao carregar categorias." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: categorias })
}

// ── POST — cria categoria nova (somente Master) ─────────────────────────────

const bodySchema = z.object({
  nome: z.string().min(1, "Nome da categoria é obrigatório."),
})

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
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  if (adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem criar categorias." } },
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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }

  const nome = parsed.data.nome.trim()
  const slug = slugify(nome)

  if (!slug) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Nome da categoria inválido." } },
      { status: 422 }
    )
  }

  // Checagem de duplicidade case-insensitive e sem acentos — o slug já
  // normaliza ambos, então bate slug com slug.
  const { data: existente } = await supabase
    .from("categorias")
    .select("id, nome")
    .eq("slug", slug)
    .maybeSingle()

  if (existente) {
    return Response.json({ success: true, data: existente })
  }

  const { data: categoria, error } = await supabase
    .from("categorias")
    .insert({ nome, slug })
    .select("id, nome")
    .single()

  if (error || !categoria) {
    // Corrida: outra requisição criou a mesma categoria entre a checagem e o
    // insert (slug é UNIQUE). Em vez de falhar, retorna a que já existe.
    if (error?.code === "23505") {
      const { data: criadaEmParalelo } = await supabase
        .from("categorias")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle()

      if (criadaEmParalelo) {
        return Response.json({ success: true, data: criadaEmParalelo })
      }
    }

    console.error(JSON.stringify({ event: "categoria.insert.error", error, admin_id: adminUser.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao criar categoria." } },
      { status: 500 }
    )
  }

  console.log(JSON.stringify({
    event: "categoria.criada",
    categoria_id: categoria.id,
    nome: categoria.nome,
    admin_id: adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: categoria })
}
