import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { GaleriaProduto } from "@/components/produto/GaleriaProduto"

interface Imagem {
  url_cloudinary: string
  ordem: number
}

interface Lote {
  id: string
  slug: string
  nome: string
  descricao: string | null
  specs_tecnicas: Record<string, unknown> | null
  quantidade_lote: number | null
  sinistro: string | null
  categoria: string | null
  produto_imagens: Imagem[]
}

async function buscarLote(slug: string): Promise<Lote | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("produtos")
    .select(`
      id, slug, nome, descricao, specs_tecnicas,
      quantidade_lote, sinistro, categoria,
      produto_imagens (url_cloudinary, ordem)
    `)
    .eq("slug", slug)
    .eq("tipo", "tipo_b")
    .eq("status", "publicado")
    .single()

  if (error || !data) return null

  return {
    ...data,
    produto_imagens: ((data.produto_imagens ?? []) as Imagem[])
      .sort((a, b) => a.ordem - b.ordem),
  }
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const lote = await buscarLote(params.slug)
  if (!lote) return { title: "Lote não encontrado" }

  const desc = lote.descricao
    ? lote.descricao.replace(/<[^>]+>/g, "").slice(0, 160)
    : `Lote: ${lote.nome}. ${lote.quantidade_lote} unidades. Negociação direta no SalvadoShop.`

  return {
    title: `${lote.nome} — SalvadoShop`,
    description: desc,
    openGraph: {
      title: lote.nome,
      description: desc,
      images: lote.produto_imagens[0]
        ? [{ url: lote.produto_imagens[0].url_cloudinary }]
        : [],
    },
  }
}

function sanitizarHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "")
}

export default async function PaginaLote(
  { params }: { params: { slug: string } }
) {
  const lote = await buscarLote(params.slug)
  if (!lote) notFound()

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
  const mensagemWA = encodeURIComponent(
    `Olá! Tenho interesse no lote: ${lote.nome}\nQuantidade: ${lote.quantidade_lote ?? "a definir"} unidades\nVi no site: salvadoshop.com.br/lotes/${lote.slug}`
  )
  const imagens = lote.produto_imagens.map((i) => i.url_cloudinary)

  return (
    <div className="bg-white min-h-screen">
      <div className="container py-8 lg:py-12">

        {/* Breadcrumb */}
        <nav aria-label="Localização" className="mb-6 text-sm text-zinc-400">
          <ol className="flex items-center gap-1.5">
            <li><a href="/" className="hover:text-marrom-700 transition-colors">Início</a></li>
            <li aria-hidden="true">/</li>
            <li><a href="/#lotes" className="hover:text-marrom-700 transition-colors">Lotes</a></li>
            <li aria-hidden="true">/</li>
            <li className="text-marrom-700 font-medium truncate max-w-xs">{lote.nome}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* Galeria */}
          <GaleriaProduto imagens={imagens} nomeProduto={lote.nome} />

          {/* Info */}
          <div className="flex flex-col gap-6">
            {lote.categoria && (
              <p className="text-xs font-semibold uppercase tracking-widest text-marrom-400">
                {lote.categoria}
              </p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-green-600 text-white px-2.5 py-1 rounded-full">
                Lote
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold text-marrom-800 leading-snug">
              {lote.nome}
            </h1>

            {/* Sinistro */}
            {lote.sinistro && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <span aria-hidden="true" className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">{lote.sinistro}</p>
              </div>
            )}

            {/* Detalhes do lote */}
            <div className="rounded-xl border border-zinc-200 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Quantidade</span>
                <span className="font-bold text-marrom-800">
                  {lote.quantidade_lote ?? "—"} unidades
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Preço</span>
                <span className="font-semibold text-zinc-600 italic">Sob consulta</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Público-alvo</span>
                <span className="text-sm font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                  Lojas e investidores
                </span>
              </div>
            </div>

            {/* CTA WhatsApp */}
            <a
              href={`https://wa.me/${whatsapp}?text=${mensagemWA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base w-full sm:w-auto"
              aria-label={`Negociar lote ${lote.nome} via WhatsApp`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              Vamos Negociar?
            </a>

            {/* Descrição */}
            {lote.descricao && (
              <div className="border-t border-zinc-100 pt-6">
                <h2 className="text-base font-semibold text-marrom-800 mb-3">Sobre este lote</h2>
                <div
                  className="prose prose-sm prose-zinc max-w-none text-zinc-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizarHTML(lote.descricao) }}
                />
              </div>
            )}

            {/* Specs */}
            {lote.specs_tecnicas && Object.keys(lote.specs_tecnicas).length > 0 && (
              <div className="border-t border-zinc-100 pt-6">
                <h2 className="text-base font-semibold text-marrom-800 mb-3">Composição do Lote</h2>
                <dl className="grid grid-cols-1 gap-1.5">
                  {Object.entries(lote.specs_tecnicas).map(([chave, valor]) => {
                    const label = chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                    const texto = Array.isArray(valor) ? valor.join(", ") : String(valor)
                    return (
                      <div key={chave} className="flex gap-3 py-1.5 border-b border-zinc-50 last:border-0">
                        <dt className="text-xs font-semibold text-zinc-500 w-32 shrink-0">{label}</dt>
                        <dd className="text-xs text-zinc-700">{texto}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
