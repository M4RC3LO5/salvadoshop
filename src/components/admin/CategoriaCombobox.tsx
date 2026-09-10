"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { slugify } from "@/lib/utils/slugify"

export interface CategoriaOption {
  id: string
  nome: string
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

interface CategoriaComboboxProps {
  id?: string
  categorias: CategoriaOption[]
  value: CategoriaOption | null
  onChange: (categoria: CategoriaOption) => void
  onCategoriaCriada?: (categoria: CategoriaOption) => void
  podeCriar: boolean
  erro?: boolean
  disabled?: boolean
}

type Opcao = CategoriaOption | { criar: true }

export function CategoriaCombobox({
  id,
  categorias,
  value,
  onChange,
  onCategoriaCriada,
  podeCriar,
  erro,
  disabled,
}: CategoriaComboboxProps) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState(value?.nome ?? "")
  const [ativo, setAtivo] = useState(0)
  const [criando, setCriando] = useState(false)
  const [erroCriacao, setErroCriacao] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => {
    setTermo(value?.nome ?? "")
  }, [value?.id, value?.nome])

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
        setTermo(value?.nome ?? "")
      }
    }
    document.addEventListener("mousedown", onClickFora)
    return () => document.removeEventListener("mousedown", onClickFora)
  }, [value])

  const termoSlug = slugify(termo)

  const filtradas = useMemo(() => {
    if (!termoSlug) return categorias
    return categorias.filter((c) => slugify(c.nome).includes(termoSlug))
  }, [categorias, termoSlug])

  const existeExata = categorias.some((c) => slugify(c.nome) === termoSlug)
  const mostrarCriar = podeCriar && termo.trim().length > 0 && !existeExata

  const opcoes: Opcao[] = mostrarCriar ? [...filtradas, { criar: true }] : filtradas

  async function criarCategoria() {
    if (criando || !termo.trim()) return
    setCriando(true)
    setErroCriacao("")
    try {
      const res = await fetch("/api/admin/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: termo.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErroCriacao(json.error?.message ?? "Erro ao criar categoria.")
        return
      }
      const nova: CategoriaOption = json.data
      onChange(nova)
      onCategoriaCriada?.(nova)
      setTermo(nova.nome)
      setAberto(false)
    } catch {
      setErroCriacao("Erro de conexão ao criar categoria.")
    } finally {
      setCriando(false)
    }
  }

  function selecionar(opcao: CategoriaOption) {
    onChange(opcao)
    setTermo(opcao.nome)
    setAberto(false)
    setErroCriacao("")
  }

  function ativarOpcao(opcao: Opcao) {
    if ("criar" in opcao) {
      criarCategoria()
    } else {
      selecionar(opcao)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault()
      setAberto(true)
      setAtivo(0)
      return
    }
    if (!aberto) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setAtivo((i) => Math.min(i + 1, opcoes.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setAtivo((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const opcao = opcoes[ativo]
      if (opcao) ativarOpcao(opcao)
    } else if (e.key === "Escape") {
      setAberto(false)
      setTermo(value?.nome ?? "")
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            setAberto(true)
            setAtivo(0)
            setErroCriacao("")
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar ou criar categoria..."
          className={cn(
            "w-full rounded-lg border px-3 py-2.5 pr-9 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:ring-2",
            erro
              ? "border-red-400 focus:border-red-400 focus:ring-red-200"
              : "border-stone-300 focus:border-amber-700 focus:ring-amber-700/20"
          )}
        />
        <ChevronsUpDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
      </div>

      {aberto && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Categorias"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {opcoes.length === 0 && (
            <li className="px-3 py-2 text-sm text-stone-400">Nenhuma categoria encontrada.</li>
          )}
          {opcoes.map((opcao, idx) => {
            if ("criar" in opcao) {
              return (
                <li key="__criar__" role="option" aria-selected={false}>
                  <button
                    type="button"
                    disabled={criando}
                    onMouseDown={(e) => { e.preventDefault(); criarCategoria() }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700",
                      idx === ativo ? "bg-amber-50" : "hover:bg-amber-50/60"
                    )}
                  >
                    {criando
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      : <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    }
                    Criar categoria: &ldquo;{termo.trim()}&rdquo;
                  </button>
                </li>
              )
            }
            const selecionada = value?.id === opcao.id
            return (
              <li key={opcao.id} role="option" aria-selected={selecionada}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selecionar(opcao) }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-stone-700",
                    idx === ativo ? "bg-amber-50" : "hover:bg-stone-50"
                  )}
                >
                  {opcao.nome}
                  {selecionada && <Check className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {erroCriacao && (
        <p className="mt-1 text-xs text-red-600" role="alert">{erroCriacao}</p>
      )}
    </div>
  )
}
