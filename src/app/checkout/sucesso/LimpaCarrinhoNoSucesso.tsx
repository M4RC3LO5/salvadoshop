"use client"

import { useEffect, useRef } from "react"
import { useCarrinho } from "@/contexts/CarrinhoContext"

// Esvazia o carrinho quando o pagamento é confirmado. Usa useCarrinho() do
// CarrinhoProvider de src/app/checkout/layout.tsx — isolado do provider do
// layout público (Header/carrinho), mas ambos persistem no mesmo localStorage,
// então o esvaziamento aqui já reflete lá na próxima vez que aquele provider
// hidratar (ex: ao voltar para a home).
export function LimpaCarrinhoNoSucesso() {
  const { limpar } = useCarrinho()
  const jaLimpou = useRef(false)

  useEffect(() => {
    if (jaLimpou.current) return
    jaLimpou.current = true
    limpar()
  }, [limpar])

  return null
}
