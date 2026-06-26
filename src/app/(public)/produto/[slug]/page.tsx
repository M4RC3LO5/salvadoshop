import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { GaleriaProduto } from "@/components/produto/GaleriaProduto"
import { BotaoCompraTipoA } from "@/components/produto/BotaoCompraTipoA"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SpecsTecnicas {
  [chave: string]: string | number | string[]
}

interface Imagem {
  url_cloudinary: string
  ordem: number
}

interface Produto {
  id: string
  slug: string
  nome: string
  tipo: "tipo_a" | "tipo_b"
  descricao: string | null
  specs_tecnicas: SpecsTecnicas | null
  preco_ml: number | null
  url_ml: string | null
  quantidade_lote: number | null
  sinistro: string | null
  categoria: string | null
  estoque: number
  produto_imagens: Imagem[]
}

// ── Busca ─────────────────────────────────────────────────────────────────────

async function buscarProduto(slug: string): Promise<Produto | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("produtos")
    .select(`
      id, slug, nome, tipo, descricao, specs_tecnicas,
      preco_ml, url_ml, quantidade_lote, sinistro, categoria, estoque,
      produto_imagens (url_cloudinary, ordem)
    `)
    .eq("slug", slug)
    .eq("status", "publicado")
    .single()

  if (error || !data) return null

  return {
    ...data,
    preco_ml: data.preco_ml ? Number(data.preco_ml) : null,
    produto_imagens: ((data.produto_imagens ?? []) as Imagem[])
      .sort((a, b) => a.ordem - b.ordem),
  }
}

// ── Metadata dinâmica ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const produto = await buscarProduto(params.slug)
  if (!produto) return { title: "Produto não encontrado" }

  const descricaoMeta = produto.descricao
    ? produto.descricao.replace(/<[^>]+>/g, "").slice(0, 160)
    : `Compre ${produto.nome} com 18% de desconto no SalvadoShop.`

  return {
    title: `${produto.nome} — SalvadoShop`,
    description: descricaoMeta,
    openGraph: {
      title: produto.nome,
      description: descricaoMeta,
      images: produto.produto_imagens[0]
        ? [{ url: produto.produto_imagens[0].url_cloudinary }]
        : [],
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function renderizarSpecs(specs: SpecsTecnicas) {
  return Object.entries(specs).map(([chave, valor]) => {
    const label = chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    const texto = Array.isArray(valor) ? valor.join(", ") : String(valor)
    return { label, texto }
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaginaProduto(
  { params }: { params: { slug: string } }
) {
  const produto = await buscarProduto(params.slug)
  if (!produto) notFound()

  const precoSite = produto.preco_ml ? produto.preco_ml * 0.82 : null
  const imagens = produto.produto_imagens.map((i) => i.url_cloudinary)
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
  const mensagemWA = encodeURIComponent(
    `Olá! Tenho interesse no produto: ${produto.nome}\nVi no site: salvadoshop.com.br/produto/${produto.slug}`
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="container py-8 lg:py-12">

        {/* Breadcrumb */}
        <nav aria-label="Localização" className="mb-6 text-sm text-zinc-400">
          <ol className="flex items-center gap-1.5">
            <li><a href="/" className="hover:text-marrom-700 transition-colors">Início</a></li>
            <li aria-hidden="true">/</li>
            {produto.categoria && (
              <>
                <li><span>{produto.categoria}</span></li>
                <li aria-hidden="true">/</li>
              </>
            )}
            <li className="text-marrom-700 font-medium truncate max-w-xs">{produto.nome}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Galeria ── */}
          <GaleriaProduto imagens={imagens} nomeProduto={produto.nome} />

          {/* ── Info ── */}
          <div className="flex flex-col gap-6">

            {/* Categoria + nome */}
            {produto.categoria && (
              <p className="text-xs font-semibold uppercase tracking-widest text-marrom-400">
                {produto.categoria}
              </p>
            )}
            <h1 className="text-2xl lg:text-3xl font-bold text-marrom-800 leading-snug">
              {produto.nome}
            </h1>

            {/* Sinistro */}
            {produto.sinistro && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <span aria-hidden="true" className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">{produto.sinistro}</p>
              </div>
            )}

            {/* Preço — Tipo A */}
            {produto.tipo === "tipo_a" && produto.preco_ml && precoSite && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-zinc-400 line-through">
                  {formatarPreco(produto.preco_ml)} no Mercado Livre
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-bold text-green-700">{formatarPreco(precoSite)}</p>
                  <span className="text-sm font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">-18%</span>
                </div>
                <p className="text-xs text-zinc-400">no site · economize {formatarPreco(produto.preco_ml - precoSite)}</p>
              </div>
            )}

            {/* Tipo B — sem preço fixo */}
            {produto.tipo === "tipo_b" && (
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold text-zinc-500 italic">Preço sob consulta</p>
                <p className="text-sm text-zinc-400">
                  Quantidade: <strong>{produto.quantidade_lote} unidades</strong>
                </p>
              </div>
            )}

            {/* Estoque */}
            {produto.tipo === "tipo_a" && produto.estoque <= 3 && produto.estoque > 0 && (
              <p className="text-sm font-medium text-red-600">
                ⚡ Últimas {produto.estoque} unidade{produto.estoque > 1 ? "s" : ""}!
              </p>
            )}

            {/* CTA */}
            {produto.tipo === "tipo_a" && produto.preco_ml ? (
              <BotaoCompraTipoA
                produto={{
                  id: produto.id,
                  slug: produto.slug,
                  nome: produto.nome,
                  estado: "Bom",
                  precoML: produto.preco_ml,
                  urlML: produto.url_ml ?? undefined,
                  imagemUrl: imagens[0],
                }}
              />
            ) : (
              <a
                href={`https://wa.me/${whatsapp}?text=${mensagemWA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base"
                aria-label={`Negociar ${produto.nome} via WhatsApp`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                Vamos Negociar?
              </a>
            )}

            {/* Descrição */}
            {produto.descricao && (
              <div className="border-t border-zinc-100 pt-6">
                <h2 className="text-base font-semibold text-marrom-800 mb-3">Descrição</h2>
                <div
                  className="prose prose-sm prose-zinc max-w-none text-zinc-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizarHTML(produto.descricao) }}
                />
              </div>
            )}

            {/* Specs técnicas */}
            {produto.specs_tecnicas && Object.keys(produto.specs_tecnicas).length > 0 && (
              <div className="border-t border-zinc-100 pt-6">
                <h2 className="text-base font-semibold text-marrom-800 mb-3">Especificações Técnicas</h2>
                <dl className="grid grid-cols-1 gap-1.5">
                  {renderizarSpecs(produto.specs_tecnicas).map(({ label, texto }) => (
                    <div key={label} className="flex gap-3 py-1.5 border-b border-zinc-50 last:border-0">
                      <dt className="text-xs font-semibold text-zinc-500 w-32 shrink-0">{label}</dt>
                      <dd className="text-xs text-zinc-700">{texto}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Sanitização simples: permite apenas tags seguras de formatação de texto
function sanitizarHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "")
}
