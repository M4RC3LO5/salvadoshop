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

function lerCarrinhoInicial(): ItemCarrinho[] {
  // No servidor não há localStorage — inicia vazio (o `carregado` abaixo
  // garante que o valor exposto só passa a refletir o localStorage após o
  // mount, evitando mismatch de hidratação SSR/CSR).
  if (typeof window === "undefined") return []
  try {
    const salvo = window.localStorage.getItem(CHAVE_LOCAL_STORAGE)
    return salvo ? JSON.parse(salvo) : []
  } catch {
    // localStorage indisponível ou JSON inválido — ignorar silenciosamente
    return []
  }
}

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  // Leitura do valor inicial via lazy initializer: o estado já nasce com o
  // conteúdo do localStorage na primeira renderização client-side. Não há mais
  // um useEffect de hidratação que releia o localStorage depois do mount — era
  // essa segunda leitura tardia que podia sobrescrever um limpar() disparado
  // por um componente filho (ex: LimpaCarrinhoNoSucesso) montado na mesma leva.
  const [itens, setItens] = useState<ItemCarrinho[]>(lerCarrinhoInicial)
  const [carregado, setCarregado] = useState(false)

  // Marca o mount client-side. Serve só para (a) alinhar o valor exposto entre
  // SSR e a primeira renderização do cliente e (b) impedir que o efeito de
  // persistência grave antes do mount.
  useEffect(() => {
    setCarregado(true)
  }, [])

  // Persistir no localStorage a cada mudança (somente após o mount)
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

  // Valor exposto: antes do mount client-side, expõe vazio para bater com o
  // HTML do SSR (evita mismatch). Após o mount, reflete o estado real — que já
  // foi lido do localStorage pelo lazy initializer, sem releitura tardia.
  const itensVisiveis = carregado ? itens : []
  const totalItens = itensVisiveis.reduce((acc, i) => acc + i.quantidade, 0)
  const subtotal = itensVisiveis.reduce((acc, i) => acc + i.preco_site * i.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{ itens: itensVisiveis, totalItens, subtotal, adicionar, remover, atualizarQuantidade, limpar }}
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
