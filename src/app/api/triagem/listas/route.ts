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
