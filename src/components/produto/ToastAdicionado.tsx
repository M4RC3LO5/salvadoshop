"use client"

interface ToastAdicionadoProps {
  visivel: boolean
}

export function ToastAdicionado({ visivel }: ToastAdicionadoProps) {
  if (!visivel) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-green-700 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Produto adicionado ao carrinho!
    </div>
  )
}
