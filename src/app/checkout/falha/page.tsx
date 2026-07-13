import Link from "next/link"

export default function PaginaCheckoutFalha() {
  return (
    <div className="container py-8 px-4 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-marrom-800 mb-2">Pagamento não concluído</h1>
          <p className="text-sm text-zinc-500">
            Seu pagamento foi cancelado ou não foi finalizado. Nenhuma cobrança foi feita.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/checkout"
            className="inline-flex items-center justify-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Tentar novamente
          </Link>
          <Link
            href="/carrinho"
            className="inline-flex items-center justify-center gap-2 border border-zinc-200 hover:border-zinc-300 text-zinc-600 text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Voltar ao carrinho
          </Link>
        </div>
      </div>
    </div>
  )
}
