import { createClient } from "@/lib/supabase/server"
import { Hero } from "@/components/shared/Hero"
import { VitrineCliente } from "@/components/produto/VitrineCliente"

// ── Tipo interno da query ─────────────────────────────────────────────────────

export interface ProdutoPublico {
  id: string
  slug: string
  nome: string
  tipo: "tipo_a" | "tipo_b"
  categoria_id: string | null
  categoria_nome: string | null
  preco_ml: number | null
  preco_site: number | null
  exclusivo_site: boolean
  url_ml: string | null
  quantidade_lote: number | null
  sinistro: string | null
  imagem_url: string | null
}

// ── Busca produtos publicados com primeira imagem ─────────────────────────────

async function buscarProdutos(): Promise<ProdutoPublico[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("produtos")
    .select(`
      id,
      slug,
      nome,
      tipo,
      categoria_id,
      categorias (nome),
      preco_ml,
      preco_site,
      exclusivo_site,
      url_ml,
      quantidade_lote,
      sinistro,
      produto_imagens!left (url_cloudinary, ordem)
    `)
    .eq("status", "publicado")
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return data.map((p) => {
    const imagens = (p.produto_imagens ?? []) as { url_cloudinary: string; ordem: number }[]
    const principal = imagens.sort((a, b) => a.ordem - b.ordem)[0]
    const categoria = p.categorias as unknown as { nome: string } | null
    return {
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      tipo: p.tipo,
      categoria_id: p.categoria_id,
      categoria_nome: categoria?.nome ?? null,
      preco_ml: p.preco_ml ? Number(p.preco_ml) : null,
      preco_site: p.preco_site ? Number(p.preco_site) : null,
      exclusivo_site: p.exclusivo_site,
      url_ml: p.url_ml,
      quantidade_lote: p.quantidade_lote,
      sinistro: p.sinistro,
      imagem_url: principal?.url_cloudinary ?? null,
    }
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const produtos = await buscarProdutos()

  return (
    <>
      <Hero />
      <VitrineCliente produtos={produtos} />
    </>
  )
}
