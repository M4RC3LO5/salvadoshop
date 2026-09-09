"use client"

import { useState } from "react"
import { useCarrinho } from "@/contexts/CarrinhoContext"
import type { ProdutoTipoA } from "./CardProdutoTipoA"

// Adiciona ao carrinho sem passar pela janela de escolha ML × Site — usado
// para produto exclusivo do site, que não tem opção de compra no ML.
export function useCompraDireta(produto: ProdutoTipoA) {
  const { adicionar } = useCarrinho()
  const [adicionado, setAdicionado] = useState(false)

  function comprar() {
    adicionar({
      produto_id: produto.id,
      nome: produto.nome,
      preco_site: produto.precoSite,
      preco_ml: produto.precoML,
      imagem: produto.imagemUrl,
    })
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 1500)
  }

  return { adicionado, comprar }
}
