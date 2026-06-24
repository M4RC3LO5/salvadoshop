import Link from "next/link"

const badges = [
  {
    icon: "🏡",
    titulo: "Família há 20 anos no mercado",
    descricao: "Tradição e confiança desde o início",
  },
  {
    icon: "🔒",
    titulo: "Compra Segura",
    descricao: "Pagamento protegido e garantido",
  },
  {
    icon: "🚚",
    titulo: "Entrega Nacional",
    descricao: "Enviamos para todo o Brasil",
  },
]

export function Hero() {
  return (
    <section className="bg-ambar-50 py-14 md:py-20">
      <div className="container">
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">

          {/* Conteúdo principal */}
          <div className="flex flex-col gap-6 max-w-xl">
            <div className="flex flex-col gap-3">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-ambar-600 bg-ambar-100 px-3 py-1 rounded-full w-fit">
                Produtos Salvados
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-marrom-800 leading-tight">
                Produtos Salvados com{" "}
                <span className="text-ambar-600">Qualidade Garantida</span>
              </h1>
              <p className="text-marrom-600 text-base md:text-lg">
                Adquiridos de transportadoras, seguradoras e leilões da Receita Federal.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#catalogo"
                className="inline-flex items-center justify-center bg-marrom-700 hover:bg-marrom-800 text-white font-semibold px-6 py-3 rounded-md transition-colors text-sm"
              >
                Ver Produtos
              </Link>
              <Link
                href="/#lotes"
                className="inline-flex items-center justify-center bg-ambar-500 hover:bg-ambar-600 text-white font-semibold px-6 py-3 rounded-md transition-colors text-sm"
              >
                Ver Lotes
              </Link>
            </div>

            {/* Badges — mobile (abaixo dos botões) */}
            <div className="flex flex-col gap-3 md:hidden">
              {badges.map((badge) => (
                <div
                  key={badge.titulo}
                  className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3"
                >
                  <span className="text-2xl" aria-hidden="true">{badge.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{badge.titulo}</p>
                    <p className="text-xs text-green-600">{badge.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Badges — desktop (lateral direita) */}
          <div className="hidden md:flex flex-col gap-4 min-w-[260px]">
            {badges.map((badge) => (
              <div
                key={badge.titulo}
                className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-5 py-4 shadow-sm"
              >
                <span className="text-3xl" aria-hidden="true">{badge.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">{badge.titulo}</p>
                  <p className="text-xs text-green-600">{badge.descricao}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
