"use client"

import { useEffect, useState } from "react"
import type { ProdutoTipoA } from "./CardProdutoTipoA"
import { useCarrinho } from "@/contexts/CarrinhoContext"

interface PopupCompraTipoAProps {
  produto: ProdutoTipoA
  onFechar: () => void
}

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function PopupCompraTipoA({ produto, onFechar }: PopupCompraTipoAProps) {
  const { adicionar } = useCarrinho()
  const [toastVisivel, setToastVisivel] = useState(false)

  const precoSite = produto.precoML * 0.82
  const economia = produto.precoML - precoSite

  // Fechar com Esc
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onFechar])

  // Travar scroll do body
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  function handleComprarAqui() {
    adicionar({
      produto_id: produto.id,
      nome: produto.nome,
      preco_site: precoSite,
      preco_ml: produto.precoML,
      url_ml: produto.urlML,
      imagem: produto.imagemUrl,
    })
    setToastVisivel(true)
    setTimeout(() => {
      setToastVisivel(false)
      onFechar()
    }, 1500)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Onde você prefere comprar?"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onFechar}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl border-2 border-ambar-400 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-marrom-800">Onde você prefere comprar?</h2>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{produto.nome}</p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors ml-3 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cards */}
        <div className="flex flex-col sm:flex-row gap-3 p-5">

          {/* LEFT — Mercado Livre */}
          <div className="flex-1 flex flex-col gap-3 border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">🛡️</span>
              <span className="text-sm font-semibold text-zinc-700">Mercado Livre</span>
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-800">{formatarPreco(produto.precoML)}</p>
              <p className="text-xs text-zinc-500 mt-1">Compra protegida pela plataforma</p>
            </div>
            {produto.urlML ? (
              <a
                href={produto.urlML}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                aria-label="Comprar no Mercado Livre — abre em nova aba"
              >
                Comprar no ML
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ) : (
              <button
                disabled
                className="w-full inline-flex items-center justify-center bg-ambar-200 text-ambar-700 text-sm font-semibold py-2.5 rounded-lg cursor-not-allowed"
                title="Link do ML não disponível"
              >
                Comprar no ML
              </button>
            )}
          </div>

          {/* RIGHT — Nosso Site */}
          <div className="flex-1 flex flex-col gap-3 border-2 border-green-400 rounded-xl p-4 bg-green-50">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">🏷️</span>
              <span className="text-sm font-semibold text-green-700">Nosso Site</span>
              <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full ml-auto">-18%</span>
            </div>
            <div>
              <p className="text-xl font-bold text-green-700">{formatarPreco(precoSite)}</p>
              <p className="text-xs text-green-600 mt-1 font-medium">
                Economize {formatarPreco(economia)} comprando aqui
              </p>
            </div>
            <button
              onClick={handleComprarAqui}
              disabled={toastVisivel}
              className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {toastVisivel ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Adicionado!
                </>
              ) : (
                "Comprar aqui"
              )}
            </button>
          </div>

        </div>

        {/* Aviso segurança */}
        <p className="text-center text-[11px] text-zinc-400 pb-4 px-5">
          🔒 Pagamentos processados com segurança via Stripe e Mercado Pago
        </p>
      </div>

      {/* Toast */}
      {toastVisivel && (
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
      )}
    </div>
  )
}
