import { Hero } from "@/components/shared/Hero"
import { CardProdutoTipoA, type ProdutoTipoA } from "@/components/produto/CardProdutoTipoA"

const produtosExemplo: ProdutoTipoA[] = [
  {
    id: "1",
    slug: "notebook-dell-inspiron-15",
    nome: "Notebook Dell Inspiron 15 — Core i5, 8GB RAM, 256GB SSD",
    estado: "Bom",
    precoML: 2499.90,
  },
  {
    id: "2",
    slug: "smartphone-samsung-galaxy-a54",
    nome: "Smartphone Samsung Galaxy A54 5G 128GB Azul",
    estado: "Regular",
    precoML: 1199.00,
  },
  {
    id: "3",
    slug: "tv-lg-50-4k",
    nome: "Smart TV LG 50\" 4K UHD LED com ThinQ AI e WebOS",
    estado: "Bom",
    precoML: 3299.00,
  },
]

export default function Home() {
  return (
    <>
      <Hero />

      {/* Vitrine — produtos Tipo A */}
      <section id="catalogo" className="bg-white py-12">
        <div className="container">
          <div className="flex flex-col gap-2 mb-8">
            <h2 className="text-2xl font-bold text-marrom-800">Produtos em Destaque</h2>
            <p className="text-marrom-500 text-sm">
              Compre pelo site e economize 18% em relação ao Mercado Livre.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {produtosExemplo.map((produto) => (
              <CardProdutoTipoA key={produto.id} produto={produto} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
