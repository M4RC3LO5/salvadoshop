import Link from "next/link"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { NovoProdutoForm } from "./NovoProdutoForm"
import { montarRascunhoProduto, type DadosParaProduto, type ImagemAnuncio } from "@/lib/anuncio-ia/montar-produto"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
// Sem isso, o fetch do supabase-js pode ser servido do Next.js Data Cache
// mesmo após o registro já estar correto no banco.
export const dynamic = "force-dynamic"

export default async function NovoProdutoPage({
  searchParams,
}: {
  searchParams?: { anuncio_ia?: string | string[] }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role, nome")
    .eq("user_id", user?.id ?? "")
    .eq("ativo", true)
    .single()

  const isAuxiliar = adminUser?.role === "auxiliar"

  // Vindo de um Anúncio por fotos "pronto": pré-preenche o formulário.
  const anuncioBruto = typeof searchParams?.anuncio_ia === "string" ? searchParams.anuncio_ia : ""
  const anuncioParam = z.uuid().safeParse(anuncioBruto)
  let inicial: (ReturnType<typeof montarRascunhoProduto> & { categoria_nome?: string }) | undefined
  let anuncioIaId: string | undefined
  let anuncioIndisponivel = false

  if (anuncioParam.success) {
    const { data: anuncio } = await supabase
      .from("anuncios_ia")
      .select("id, status, imagens, dados_ia")
      .eq("id", anuncioParam.data)
      .maybeSingle()

    if (anuncio && anuncio.status === "pronto") {
      const dadosIa = (anuncio.dados_ia ?? {}) as DadosParaProduto
      const rascunho = montarRascunhoProduto(
        dadosIa,
        (Array.isArray(anuncio.imagens) ? anuncio.imagens : []) as ImagemAnuncio[]
      )
      let categoriaNome: string | undefined
      if (rascunho.categoria_id) {
        const { data: categoria } = await supabase
          .from("categorias")
          .select("nome")
          .eq("id", rascunho.categoria_id)
          .maybeSingle()
        categoriaNome = categoria?.nome ?? undefined
        // Categoria que não existe mais: segue sem categoria em vez de enviar um id inválido
        if (!categoria) rascunho.categoria_id = null
      }
      inicial = { ...rascunho, categoria_nome: categoriaNome }
      anuncioIaId = anuncio.id as string
    } else {
      anuncioIndisponivel = true
    }
  } else if (anuncioBruto) {
    anuncioIndisponivel = true
  }

  return (
    <div className="mx-auto max-w-5xl">

      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-1 flex items-center gap-2 text-xs text-stone-400">
        <Link href="/admin/produtos" className="hover:text-stone-600 transition-colors">
          Produtos
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-stone-600 font-medium">Novo</span>
      </nav>

      {/* Título */}
      <h1 className="mb-6 text-2xl font-bold text-stone-800">Novo Produto</h1>

      {anuncioIndisponivel && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Este anúncio não está disponível para virar produto.
        </p>
      )}

      {inicial && (
        <p
          role="note"
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          Criando produto a partir do Anúncio por fotos. Confira os dados e defina tipo, preço e estoque.
        </p>
      )}

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
              Produto entrará para aprovação
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Como <strong>Auxiliar</strong>, seus produtos ficam com status{" "}
              <strong>Pendente</strong> até serem aprovados pelo Master.
              Você receberá uma notificação após a revisão.
            </p>
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <NovoProdutoForm
          role={adminUser?.role === "master" ? "master" : "auxiliar"}
          inicial={inicial}
          anuncioIaId={anuncioIaId}
        />
      </div>

    </div>
  )
}
