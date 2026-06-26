import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProdutosClientUI, type ProdutoRow } from "./ProdutosClientUI"

const POR_PAGINA = 10

interface PageProps {
  searchParams: {
    pagina?: string
    busca?: string
    status?: string
    tipo?: string
  }
}

export default async function ProdutosPage({ searchParams }: PageProps) {
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
  const isMaster = role === "master"

  // Paginação e filtros
  const pagina = Math.max(1, parseInt(searchParams.pagina ?? "1", 10))
  const busca = searchParams.busca?.trim() ?? ""
  const statusFiltro = searchParams.status ?? ""
  const tipoFiltro = searchParams.tipo ?? ""
  const offset = (pagina - 1) * POR_PAGINA

  // Query base: join com a primeira imagem de cada produto
  let query = supabase
    .from("produtos")
    .select(
      `id, nome, slug, tipo, preco_ml, status, created_at, criado_por,
       produto_imagens!left ( url_cloudinary, ordem )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("ordem", { referencedTable: "produto_imagens", ascending: true })
    .range(offset, offset + POR_PAGINA - 1)

  // Auxiliar só vê os próprios produtos
  if (!isMaster) {
    query = query.eq("criado_por", adminUser.id)
  }

  // Filtros opcionais
  if (busca) {
    query = query.ilike("nome", `%${busca}%`)
  }
  if (statusFiltro) {
    query = query.eq("status", statusFiltro)
  }
  if (tipoFiltro) {
    query = query.eq("tipo", tipoFiltro)
  }

  const { data: rows, count, error } = await query

  if (error) {
    console.error(JSON.stringify({ event: "produtos.list.error", error }))
  }

  // Normaliza: pega só a primeira imagem de cada produto
  const produtos: ProdutoRow[] = (rows ?? []).map((row) => {
    const imagens = Array.isArray(row.produto_imagens) ? row.produto_imagens : []
    const primeira = imagens[0] as { url_cloudinary: string } | undefined
    return {
      id: row.id,
      nome: row.nome,
      slug: row.slug,
      tipo: row.tipo as "tipo_a" | "tipo_b",
      preco_ml: row.preco_ml,
      status: row.status,
      created_at: row.created_at,
      imagem_url: primeira?.url_cloudinary ?? null,
    }
  })

  return (
    <ProdutosClientUI
      produtos={produtos}
      total={count ?? 0}
      pagina={pagina}
      porPagina={POR_PAGINA}
      role={role}
    />
  )
}
