import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TriagemClientUI, type ListaRow } from "./TriagemClientUI"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
// Sem isso, o fetch do supabase-js pode ser servido do Next.js Data Cache
// mesmo após o registro já estar correto no banco.
export const dynamic = "force-dynamic"

export default async function TriagemPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) redirect("/")

  const { data: listasData } = await supabase
    .from("triagem_listas")
    .select("id, nome, created_at, itens:estoque_itens(count)")
    .order("created_at", { ascending: false })

  const listasIniciais: ListaRow[] = (listasData ?? []).map((lista) => ({
    id: lista.id,
    nome: lista.nome,
    created_at: lista.created_at,
    qtd_itens: lista.itens?.[0]?.count ?? 0,
  }))

  return <TriagemClientUI listasIniciais={listasIniciais} role={adminUser.role as "master" | "auxiliar"} />
}
