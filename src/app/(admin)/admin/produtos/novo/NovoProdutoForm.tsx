"use client"

import { useState } from "react"
import { Package, Layers } from "lucide-react"
import { RichTextEditor } from "@/components/admin/RichTextEditor"
import { ImageUploadZone } from "@/components/admin/ImageUploadZone"

type TipoProduto = "tipo_a" | "tipo_b" | null

interface ImagemSalva {
  url: string
  public_id: string
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export function NovoProdutoForm() {
  const [tipo, setTipo] = useState<TipoProduto>(null)
  const [precoML, setPrecoML] = useState<string>("")
  const [nome, setNome] = useState<string>("")
  const [specs, setSpecs] = useState<string>("")
  const [descricao, setDescricao] = useState<string>("")
  const [quantidade, setQuantidade] = useState<string>("")
  const [imagens, setImagens] = useState<ImagemSalva[]>([])

  const precoMLNum = parseFloat(precoML.replace(",", ".")) || 0
  const precoSite = precoMLNum > 0 ? precoMLNum * 0.82 : null

  const nomeError = nome.length > 0 && nome.length < 10
  const formIsValid =
    nome.length >= 10 &&
    specs.trim().length > 0 &&
    descricao.trim().length > 0 &&
    tipo !== null &&
    imagens.length > 0

  return (
    <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()}>

      {/* Layout duas colunas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Coluna esquerda — upload de imagens ── */}
        <ImageUploadZone onChange={setImagens} />

        {/* ── Coluna direita — campos de texto ── */}
        <div className="flex flex-col gap-5">

          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-stone-700">
              Nome do Produto <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              minLength={10}
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder='Ex: Smart TV Samsung 55" 4K Crystal UHD'
              aria-describedby={nomeError ? "nome-error" : undefined}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:ring-2",
                nomeError
                  ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                  : "border-stone-300 focus:border-amber-700 focus:ring-amber-700/20"
              )}
            />
            {nomeError && (
              <p id="nome-error" className="text-xs text-red-600" role="alert">
                Nome deve ter pelo menos 10 caracteres.
              </p>
            )}
            <p className="text-xs text-stone-400">{nome.length}/200 caracteres</p>
          </div>

          {/* Especificações Técnicas */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="specs" className="text-sm font-medium text-stone-700">
              Especificações Técnicas <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="specs"
              name="specs"
              required
              rows={4}
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              placeholder="Bateria 40h, Bluetooth 5.3, cancelamento de ruído, tela AMOLED 6.7'', 256GB armazenamento..."
              className="resize-y rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
            <p className="text-xs text-stone-400">
              Campo livre — descreva as especificações relevantes para o comprador.
            </p>
          </div>

        </div>
      </div>

      {/* ── Descrição Comercial (Rich Text) ── */}
      <RichTextEditor onChange={setDescricao} nome={nome} specs={specs} />

      {/* ── Seletor de tipo ── */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-stone-700">
          Tipo de Produto <span className="text-red-500" aria-hidden="true">*</span>
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Tipo A */}
          <button
            type="button"
            onClick={() => setTipo("tipo_a")}
            aria-pressed={tipo === "tipo_a"}
            className={cn(
              "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2",
              tipo === "tipo_a"
                ? "border-amber-700 bg-amber-50"
                : "border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/40"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tipo === "tipo_a" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-500"
            )}>
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-semibold", tipo === "tipo_a" ? "text-amber-800" : "text-stone-700")}>
                Produto Individual
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                Preço fixo no ML · desconto de 18% no site · compra unitária pelo cliente
              </p>
            </div>
          </button>

          {/* Tipo B */}
          <button
            type="button"
            onClick={() => setTipo("tipo_b")}
            aria-pressed={tipo === "tipo_b"}
            className={cn(
              "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2",
              tipo === "tipo_b"
                ? "border-amber-700 bg-amber-50"
                : "border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/40"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tipo === "tipo_b" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-500"
            )}>
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-semibold", tipo === "tipo_b" ? "text-amber-800" : "text-stone-700")}>
                Lote para Revendedores
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                Quantidade fixa · sem preço fixo · negociação via WhatsApp
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* ── Campos condicionais ── */}
      {tipo === "tipo_a" && (
        <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-stone-700">
            Precificação — Produto Individual
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="preco_ml" className="text-sm font-medium text-stone-700">
                Preço no Mercado Livre (R$) <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">R$</span>
                <input
                  id="preco_ml"
                  name="preco_ml"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={precoML}
                  onChange={(e) => setPrecoML(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Preço no Site (−18% automático)</span>
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                {precoSite !== null ? (
                  <>
                    <span className="text-lg font-bold text-green-700">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoSite)}
                    </span>
                    <span className="text-xs text-green-600">(calculado automaticamente)</span>
                  </>
                ) : (
                  <span className="text-sm text-stone-400">Informe o preço ML para calcular</span>
                )}
              </div>
              <p className="text-xs text-stone-400">Fórmula: Preço ML × 0,82 — gerado pelo banco de dados</p>
            </div>
          </div>
        </div>
      )}

      {tipo === "tipo_b" && (
        <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-stone-700">Detalhes do Lote</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quantidade_lote" className="text-sm font-medium text-stone-700">
                Quantidade de Itens no Lote <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="quantidade_lote"
                name="quantidade_lote"
                type="number"
                min="1"
                step="1"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 40"
                className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
              />
              <p className="text-xs text-stone-400">Quantidade fixa — não pode ser alterada pelo comprador.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Preço</span>
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-amber-700">Preço sob consulta</span>
              </div>
              <p className="text-xs text-stone-400">Negociação via WhatsApp — sem preço fixo para lotes.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Botões de ação ── */}
      <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!formIsValid}
          className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          title={!formIsValid ? "Preencha todos os campos obrigatórios" : undefined}
        >
          Salvar Produto
        </button>
      </div>

    </form>
  )
}
