"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCarrinho } from "@/contexts/CarrinhoContext"

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function PaginaCarrinho() {
  const { itens, subtotal, remover, atualizarQuantidade } = useCarrinho()
  const [cep, setCep] = useState("")
  const router = useRouter()

  if (itens.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-ambar-100 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ambar-500"
            aria-hidden="true"
          >
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-marrom-800 mb-2">Seu carrinho está vazio</h1>
          <p className="text-sm text-zinc-500">Explore nossa vitrine e encontre produtos com ótimos preços!</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Voltar à loja
        </Link>
      </div>
    )
  }

  return (
    <div className="container py-8 px-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-marrom-800 mb-6">Meu Carrinho</h1>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* Lista de itens */}
        <section className="flex-1" aria-label="Itens no carrinho">
          <ul className="flex flex-col gap-4">
            {itens.map((item) => (
              <li
                key={item.produto_id}
                className="flex gap-4 bg-white border border-marrom-100 rounded-xl p-4 shadow-sm"
              >
                {/* Imagem */}
                <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                  {item.imagem ? (
                    <Image
                      src={item.imagem}
                      alt={item.nome}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-marrom-800 leading-snug line-clamp-2">
                    {item.nome}
                  </p>
                  <p className="text-base font-bold text-green-700">
                    {formatarPreco(item.preco_site)}
                  </p>

                  {/* Quantidade + remover */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          if (item.quantidade === 1) {
                            remover(item.produto_id)
                          } else {
                            atualizarQuantidade(item.produto_id, item.quantidade - 1)
                          }
                        }}
                        aria-label="Diminuir quantidade"
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors text-lg leading-none"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-zinc-800" aria-label={`Quantidade: ${item.quantidade}`}>
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + 1)}
                        aria-label="Aumentar quantidade"
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors text-lg leading-none"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => remover(item.produto_id)}
                      aria-label={`Remover ${item.nome} do carrinho`}
                      className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                {/* Subtotal do item */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-zinc-400 mb-0.5">Total</p>
                  <p className="text-sm font-bold text-marrom-800">
                    {formatarPreco(item.preco_site * item.quantidade)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-ambar-600 hover:text-ambar-700 font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Continuar comprando
          </Link>
        </section>

        {/* Resumo do pedido */}
        <aside className="lg:w-80 shrink-0" aria-label="Resumo do pedido">
          <div className="bg-white border border-marrom-100 rounded-xl p-5 shadow-sm flex flex-col gap-4 sticky top-4">
            <h2 className="text-base font-bold text-marrom-800">Resumo do pedido</h2>

            {/* CEP */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cep" className="text-xs font-medium text-zinc-600">
                Calcular frete (em breve)
              </label>
              <div className="flex gap-2">
                <input
                  id="cep"
                  type="text"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 8)
                    setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v)
                  }}
                  maxLength={9}
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ambar-400 disabled:bg-zinc-50"
                  aria-describedby="cep-hint"
                />
                <button
                  disabled
                  className="text-sm font-semibold bg-zinc-100 text-zinc-400 px-3 py-2 rounded-lg cursor-not-allowed"
                  title="Cálculo de frete em breve"
                >
                  OK
                </button>
              </div>
              <p id="cep-hint" className="text-[11px] text-zinc-400">
                Cálculo de frete disponível em breve
              </p>
            </div>

            <hr className="border-zinc-100" />

            {/* Valores */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>{formatarPreco(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Frete</span>
                <span>A calcular</span>
              </div>
            </div>

            <hr className="border-zinc-100" />

            <div className="flex justify-between items-center font-bold text-marrom-800">
              <span>Total</span>
              <span className="text-lg">{formatarPreco(subtotal)}</span>
            </div>

            <button
              onClick={() => router.push("/checkout")}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-bold py-3.5 rounded-xl transition-colors"
            >
              Finalizar Compra
            </button>

            <p className="text-center text-[11px] text-zinc-400">
              🔒 Pagamento seguro via Stripe e Mercado Pago
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
