import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { NovoProdutoForm, ProdutoParaEditar } from "../../novo/NovoProdutoForm"

interface PageProps {
  params: { id: string }
}

export default async function EditarProdutoPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role, nome, id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) redirect("/admin/login")

  const isMaster = adminUser.role === "master"

  // Busca produto com imagens
  const { data: produto } = await supabase
    .from("produtos")
    .select(`
      id, nome, slug, descricao, specs_tecnicas, tipo, categoria,
      preco_ml, url_ml, estoque, quantidade_lote, status, criado_por,
      produto_imagens (url_cloudinary, public_id, ordem)
    `)
    .eq("id", params.id)
    .single()

  if (!produto) notFound()

  // Auxiliar só pode editar seus próprios produtos
  if (!isMaster && produto.criado_por !== adminUser.id) {
    redirect("/admin/produtos")
  }

  // Ordena imagens por ordem e mapeia para o formato esperado pelo form
  const imagens = (produto.produto_imagens ?? [])
    .sort((a, b) => a.ordem - b.ordem)
    .map((img) => ({ url: img.url_cloudinary, public_id: img.public_id }))

  const produtoParaEditar: ProdutoParaEditar = {
    id: produto.id,
    nome: produto.nome,
    specs_tecnicas: produto.specs_tecnicas as { texto: string } | null,
    descricao: produto.descricao,
    tipo: produto.tipo as "tipo_a" | "tipo_b",
    categoria: produto.categoria ?? "",
    preco_ml: produto.preco_ml,
    url_ml: produto.url_ml,
    estoque: produto.estoque,
    quantidade_lote: produto.quantidade_lote,
    status: produto.status,
    imagens,
  }

  const isAuxiliar = adminUser.role === "auxiliar"

  return (
    <div className="mx-auto max-w-5xl">

      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-1 flex items-center gap-2 text-xs text-stone-400">
        <Link href="/admin/produtos" className="hover:text-stone-600 transition-colors">
          Produtos
        </Link>
        <span aria-hidden="true">›</span>
        <span className="max-w-[200px] truncate text-stone-600 font-medium">{produto.nome}</span>
        <span aria-hidden="true">›</span>
        <span className="text-stone-600 font-medium">Editar</span>
      </nav>

      {/* Título */}
      <h1 className="mb-6 text-2xl font-bold text-stone-800">Editar Produto</h1>

      {/* Banner de aviso — Auxiliar */}
      {isAuxiliar && (
        <div
          role="note"
          aria-label="Aviso sobre fluxo de aprovação"
          className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Alterações entrarão para aprovação
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Como <strong>Auxiliar</strong>, suas alterações ficam com status{" "}
              <strong>Pendente</strong> até serem aprovadas pelo Master.
              O produto atual permanece visível até a aprovação.
            </p>
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <NovoProdutoForm
          role={adminUser.role as "master" | "auxiliar"}
          produto={produtoParaEditar}
          modo="editar"
        />
      </div>

    </div>
  )
}
