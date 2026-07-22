import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PedidosClientUI, type PedidoRow } from "./PedidosClientUI"

const POR_PAGINA = 20

interface PageProps {
  searchParams: {
    pagina?: string
    status?: string
  }
}

export default async function PedidosPage({ searchParams }: PageProps) {
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

  const role = adminUser.role as "master" | "auxiliar"

  // Paginação e filtros
  const pagina = Math.max(1, parseInt(searchParams.pagina ?? "1", 10))
  const statusFiltro = searchParams.status ?? ""
  const offset = (pagina - 1) * POR_PAGINA

  // Master e Auxiliar veem todos os pedidos (decisão de negócio; RLS já permite)
  let query = supabase
    .from("pedidos")
    .select("id, status, total, created_at, comprador_nome, comprador_email, codigo_rastreio", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1)

  if (statusFiltro) {
    query = query.eq("status", statusFiltro)
  }

  const { data: rows, count, error } = await query

  if (error) {
    console.error(JSON.stringify({ event: "pedidos.list.error", error }))
  }

  const pedidos: PedidoRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    total: row.total,
    created_at: row.created_at,
    comprador_nome: row.comprador_nome,
    comprador_email: row.comprador_email,
    codigo_rastreio: row.codigo_rastreio,
  }))

  return (
    <PedidosClientUI
      pedidos={pedidos}
      total={count ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      role={role}
    />
  )
}
