import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { EditorRevisao, type DadosRevisao, type ImagemRevisao } from "./EditorRevisao"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const idSchema = z.uuid()

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="space-y-4">
      <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {texto}
      </p>
      <Link href="/admin/anuncios-ia" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a fila
      </Link>
    </div>
  )
}

export default async function RevisarAnuncioPage({ params }: { params: { id: string } }) {
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

  const id = idSchema.safeParse(params.id)
  if (!id.success) return <Aviso texto="Anúncio não encontrado." />

  const { data: anuncio, error } = await supabase
    .from("anuncios_ia")
    .select("id, status, imagens, dados_ia, custo_usd")
    .eq("id", id.data)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ event: "anuncio_ia.revisar.page.error", error }))
    return <Aviso texto="Não foi possível carregar o anúncio. Tente recarregar a página." />
  }
  if (!anuncio) return <Aviso texto="Anúncio não encontrado." />
  if (anuncio.status !== "pronto") return <Aviso texto="Este anúncio não está pronto para revisão." />

  const { data: categoriasData } = await supabase.from("categorias").select("id, nome").order("nome")

  const imagens = (Array.isArray(anuncio.imagens) ? anuncio.imagens : []) as ImagemRevisao[]
  const dados = (anuncio.dados_ia ?? {}) as Partial<DadosRevisao>

  return (
    <EditorRevisao
      anuncioId={anuncio.id as string}
      imagens={imagens.filter((i) => typeof i?.url === "string")}
      categorias={(categoriasData ?? []) as { id: string; nome: string }[]}
      custo={anuncio.custo_usd === null || anuncio.custo_usd === undefined ? null : Number(anuncio.custo_usd)}
      dados={{
        nome: dados.nome ?? null,
        marca: dados.marca ?? null,
        modelo: dados.modelo ?? null,
        codigo: dados.codigo ?? null,
        categoria_id: dados.categoria_id ?? null,
        especificacoes: dados.especificacoes ?? [],
        conteudo_embalagem: dados.conteudo_embalagem ?? [],
        descricao_html: dados.descricao_html ?? null,
        nao_confirmado: dados.nao_confirmado ?? [],
        pedido: dados.pedido ?? null,
      }}
    />
  )
}
