"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface ItemCarrinho {
  produto_id: string
  nome: string
  preco_site: number
  preco_ml: number
  url_ml?: string
  imagem?: string
  quantidade: number
}

interface CarrinhoContextValue {
  itens: ItemCarrinho[]
  totalItens: number
  subtotal: number
  adicionar: (item: Omit<ItemCarrinho, "quantidade">) => void
  remover: (produto_id: string) => void
  atualizarQuantidade: (produto_id: string, quantidade: number) => void
  limpar: () => void
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null)

const CHAVE_LOCAL_STORAGE = "salvadoshop_carrinho"

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [carregado, setCarregado] = useState(false)

  // Hidratar do localStorage após mount (evita hydration mismatch)
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LOCAL_STORAGE)
      if (salvo) {
        setItens(JSON.parse(salvo))
      }
    } catch {
      // localStorage indisponível ou JSON inválido — ignorar silenciosamente
    }
    setCarregado(true)
  }, [])

  // Persistir no localStorage a cada mudança
  useEffect(() => {
    if (!carregado) return
    try {
      localStorage.setItem(CHAVE_LOCAL_STORAGE, JSON.stringify(itens))
    } catch {
      // quota excedida ou modo privativo — ignorar
    }
  }, [itens, carregado])

  const adicionar = useCallback((novoItem: Omit<ItemCarrinho, "quantidade">) => {
    setItens((prev) => {
      const existente = prev.find((i) => i.produto_id === novoItem.produto_id)
      if (existente) {
        return prev.map((i) =>
          i.produto_id === novoItem.produto_id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        )
      }
      return [...prev, { ...novoItem, quantidade: 1 }]
    })
  }, [])

  const remover = useCallback((produto_id: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produto_id))
  }, [])

  const atualizarQuantidade = useCallback((produto_id: string, quantidade: number) => {
    if (quantidade < 1) return
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produto_id ? { ...i, quantidade } : i))
    )
  }, [])

  const limpar = useCallback(() => {
    setItens([])
  }, [])

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0)
  const subtotal = itens.reduce((acc, i) => acc + i.preco_site * i.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{ itens, totalItens, subtotal, adicionar, remover, atualizarQuantidade, limpar }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext)
  if (!ctx) throw new Error("useCarrinho deve ser usado dentro de CarrinhoProvider")
  return ctx
}
