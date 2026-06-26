"use client"

import { useState, useMemo } from "react"
import { CardProdutoTipoA, type ProdutoTipoA } from "./CardProdutoTipoA"
import { CardProdutoTipoB, type ProdutoTipoB } from "./CardProdutoTipoB"
import type { ProdutoPublico } from "@/app/(public)/page"

interface VitrineClienteProps {
  produtos: ProdutoPublico[]
}

// Deriva estado/condição a partir do sinistro — fallback "Bom"
function estadoDoProduto(sinistro: string | null): ProdutoTipoA["estado"] {
  if (!sinistro) return "Bom"
  const s = sinistro.toLowerCase()
  if (s.includes("novo") || s.includes("receita federal") || s.includes("apreens")) return "Bom"
  if (s.includes("restaurar") || s.includes("dano")) return "A restaurar"
  if (s.includes("regular") || s.includes("avaria")) return "Regular"
  return "Bom"
}

export function VitrineCliente({ produtos }: VitrineClienteProps) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todos")

  const tipoA = produtos.filter((p) => p.tipo === "tipo_a")
  const tipoB = produtos.filter((p) => p.tipo === "tipo_b")

  // Categorias únicas de tipo_a (lotes mostram todos)
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(tipoA.map((p) => p.categoria).filter(Boolean))) as string[]
    return ["Todos", ...cats.sort()]
  }, [tipoA])

  const tipoAFiltrados = useMemo(() =>
    categoriaAtiva === "Todos"
      ? tipoA
      : tipoA.filter((p) => p.categoria === categoriaAtiva),
    [tipoA, categoriaAtiva]
  )

  // Mapeia para o tipo esperado pelos cards
  function toCardA(p: ProdutoPublico): ProdutoTipoA {
    return {
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      estado: estadoDoProduto(p.sinistro),
      precoML: p.preco_ml ?? 0,
      imagemUrl: p.imagem_url ?? undefined,
    }
  }

  function toCardB(p: ProdutoPublico): ProdutoTipoB {
    return {
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      quantidade: p.quantidade_lote ?? 0,
      unidade: "unidades",
      imagemUrl: p.imagem_url ?? undefined,
    }
  }

  return (
    <>
      {/* ── Produtos Individuais (Tipo A) ── */}
      <section id="catalogo" className="bg-white py-12">
        <div className="container">
          <div className="flex flex-col gap-2 mb-6">
            <h2 className="text-2xl font-bold text-marrom-800">Produtos em Destaque</h2>
            <p className="text-marrom-500 text-sm">
              Compre pelo site e economize 18% em relação ao Mercado Livre.
            </p>
          </div>

          {/* Filtro por categoria */}
          {categorias.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filtrar por categoria">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaAtiva(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    categoriaAtiva === cat
                      ? "bg-marrom-700 text-white border-marrom-700"
                      : "bg-white text-marrom-600 border-marrom-200 hover:border-marrom-400"
                  }`}
                  aria-pressed={categoriaAtiva === cat}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {tipoAFiltrados.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tipoAFiltrados.map((p) => (
                <CardProdutoTipoA key={p.id} produto={toCardA(p)} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-marrom-400">
              <p className="text-lg font-medium">Em breve novos produtos</p>
              <p className="text-sm mt-1">Volte em breve para conferir as novidades.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Lotes para Revendedores (Tipo B) ── */}
      {tipoB.length > 0 && (
        <section id="lotes" className="bg-zinc-50 py-12">
          <div className="container">
            <div className="flex flex-col gap-2 mb-8">
              <h2 className="text-2xl font-bold text-marrom-800">Lotes para Revendedores</h2>
              <p className="text-marrom-500 text-sm">
                Quantidade fixa, negociação direta. Ideal para lojas, investidores e revendedores.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tipoB.map((p) => (
                <CardProdutoTipoB key={p.id} produto={toCardB(p)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
