import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

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

  const { data, error } = await supabase
    .from("triagem_listas")
    .select("id, nome, created_at, itens:estoque_itens(count)")
    .order("created_at", { ascending: false })

  if (error) {
    console.error(JSON.stringify({ event: "triagem.listas.get.error", error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao buscar as listas de triagem." } },
      { status: 500 }
    )
  }

  const listas = (data ?? []).map((lista) => ({
    id: lista.id,
    nome: lista.nome,
    created_at: lista.created_at,
    qtd_itens: lista.itens?.[0]?.count ?? 0,
  }))

  return Response.json({ success: true, data: listas })
}

const criarListaSchema = z.object({
  nome: z.string().trim().min(1).max(80),
})

export async function POST(request: Request) {
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

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    corpo = null
  }

  const parsed = criarListaSchema.safeParse(corpo)
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Informe um nome de até 80 caracteres.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("triagem_listas")
    .insert({ nome: parsed.data.nome, criado_por: adminUser.id })
    .select("id, nome")
    .single()

  if (error || !data) {
    console.error(JSON.stringify({ event: "triagem.listas.post.error", error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao criar a lista de triagem." } },
      { status: 500 }
    )
  }

  console.log(JSON.stringify({
    event: "triagem.lista.criada",
    lista_id: data.id,
    admin_id: adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: data.id, nome: data.nome } })
}
