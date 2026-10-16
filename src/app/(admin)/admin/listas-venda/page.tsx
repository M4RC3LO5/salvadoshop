import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { totalGeral } from "@/lib/utils/lista-venda"
import { ListasVendaClientUI, type ListaVendaRow } from "./ListasVendaClientUI"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

export default async function ListasVendaPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) redirect("/")

  const { data, error } = await supabase
    .from("listas_venda")
    .select("id, titulo, created_at, itens:listas_venda_itens(qtd_caixas, unid_por_caixa, preco_unitario)")
    .order("created_at", { ascending: false })

  if (error) {
    console.error(JSON.stringify({ event: "listas_venda.list.error", error }))
  }

  const listas: ListaVendaRow[] = (data ?? []).map((l) => ({
    id: l.id,
    titulo: l.titulo,
    created_at: l.created_at,
    qtd_itens: l.itens.length,
    total: totalGeral(l.itens.map((i) => ({ ...i, preco_unitario: i.preco_unitario === null ? null : Number(i.preco_unitario) }))),
  }))

  return <ListasVendaClientUI listasIniciais={listas} erroCarregar={!!error} />
}
