"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Package, Layers, MessageCircle, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react"
import { RichTextEditor } from "@/components/admin/RichTextEditor"
import { ImageUploadZone } from "@/components/admin/ImageUploadZone"

type TipoProduto = "tipo_a" | "tipo_b" | null
type Role = "master" | "auxiliar"

interface ImagemSalva {
  url: string
  public_id: string
}

interface ToastState {
  tipo: "sucesso" | "erro"
  mensagem: string
  slug?: string
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const CATEGORIAS = [
  "Eletrônicos",
  "Eletrodomésticos",
  "Móveis",
  "Veículos",
  "Ferramentas",
  "Outros",
]

function formatarMoeda(raw: string): string {
  const digitos = raw.replace(/\D/g, "")
  if (!digitos) return ""
  const centavos = parseInt(digitos, 10)
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseMoeda(formatted: string): number {
  const limpo = formatted.replace(/\./g, "").replace(",", ".")
  return parseFloat(limpo) || 0
}

function urlMLValida(url: string): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.replace("www.", "")
    return host === "mercadolivre.com.br" || host === "produto.mercadolivre.com.br"
  } catch {
    return false
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  const isSucesso = toast.tipo === "sucesso"

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all",
        isSucesso
          ? "border-green-200 bg-green-50 text-green-900"
          : "border-red-200 bg-red-50 text-red-900"
      )}
    >
      {isSucesso
        ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      }
      <div className="flex-1 text-sm">
        <p className="font-semibold">{toast.mensagem}</p>
        {isSucesso && toast.slug && (
          <a
            href={`/produto/${toast.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-800"
          >
            Ver produto <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Fechar notificação"
        className="ml-1 shrink-0 text-current opacity-50 hover:opacity-80"
      >
        ×
      </button>
    </div>
  )
}

// ── Campo reutilizável ────────────────────────────────────────────────────────

interface CampoProps {
  label: string
  htmlFor: string
  obrigatorio?: boolean
  erro?: string
  dica?: string
  children: React.ReactNode
}

function Campo({ label, htmlFor, obrigatorio, erro, dica, children }: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
        {label}{obrigatorio && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
      {!erro && dica && <p className="text-xs text-stone-400">{dica}</p>}
    </div>
  )
}

function inputCls(erro: boolean) {
  return cn(
    "rounded-lg border px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:ring-2",
    erro
      ? "border-red-400 focus:border-red-400 focus:ring-red-200"
      : "border-stone-300 focus:border-amber-700 focus:ring-amber-700/20"
  )
}

// ── Formulário principal ──────────────────────────────────────────────────────

interface NovoProdutoFormProps {
  role: Role
}

export function NovoProdutoForm({ role }: NovoProdutoFormProps) {
  const router = useRouter()
  const isMaster = role === "master"

  const [submetido, setSubmetido] = useState(false)
  const [salvando, setSalvando] = useState<"rascunho" | "pendente" | "publicado" | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Campos comuns
  const [tipo, setTipo] = useState<TipoProduto>(null)
  const [nome, setNome] = useState("")
  const [specs, setSpecs] = useState("")
  const [descricao, setDescricao] = useState("")
  const [imagens, setImagens] = useState<ImagemSalva[]>([])
  const [categoria, setCategoria] = useState("")
  const [estoque, setEstoque] = useState("")

  // Tipo A
  const [precoMLFormatado, setPrecoMLFormatado] = useState("")
  const [urlML, setUrlML] = useState("")

  // Tipo B
  const [quantidadeLote, setQuantidadeLote] = useState("")

  // ── Derivados ──
  const precoMLNum = parseMoeda(precoMLFormatado)
  const precoSite = precoMLNum > 0 ? precoMLNum * 0.82 : null
  const economia = precoMLNum > 0 ? precoMLNum - (precoMLNum * 0.82) : null

  // ── Erros ──
  const erros = {
    nome: nome.length > 0 && nome.length < 10
      ? "Nome deve ter pelo menos 10 caracteres."
      : submetido && nome.length < 10
        ? "Nome é obrigatório (mínimo 10 caracteres)."
        : "",
    specs: submetido && !specs.trim() ? "Especificações são obrigatórias." : "",
    descricao: submetido && !descricao.trim() ? "Descrição comercial é obrigatória." : "",
    tipo: submetido && !tipo ? "Selecione o tipo do produto." : "",
    imagens: submetido && imagens.length === 0 ? "Adicione ao menos uma imagem." : "",
    categoria: submetido && !categoria ? "Selecione uma categoria." : "",
    estoque: submetido && tipo === "tipo_a" && !estoque ? "Informe o estoque disponível." : "",
    precoML: submetido && tipo === "tipo_a" && precoMLNum <= 0 ? "Informe o preço no Mercado Livre." : "",
    urlML: submetido && tipo === "tipo_a" && !urlMLValida(urlML)
      ? "Informe uma URL válida do Mercado Livre (mercadolivre.com.br)."
      : urlML && !urlMLValida(urlML)
        ? "A URL deve ser do mercadolivre.com.br"
        : "",
    quantidadeLote: submetido && tipo === "tipo_b" && !quantidadeLote
      ? "Informe a quantidade do lote."
      : "",
  }

  const formIsValid =
    nome.length >= 10 &&
    specs.trim().length > 0 &&
    descricao.trim().length > 0 &&
    tipo !== null &&
    imagens.length > 0 &&
    categoria !== "" &&
    (tipo === "tipo_a"
      ? precoMLNum > 0 && urlMLValida(urlML) && estoque !== ""
      : quantidadeLote !== "")

  // ── Salvar ──
  async function salvar(statusSolicitado: "rascunho" | "pendente" | "publicado") {
    setSubmetido(true)
    if (statusSolicitado !== "rascunho" && !formIsValid) return

    setSalvando(statusSolicitado)
    setToast(null)

    try {
      const body: Record<string, unknown> = {
        nome,
        specs,
        descricao,
        tipo,
        categoria,
        imagens,
        status_solicitado: statusSolicitado,
      }

      if (tipo === "tipo_a") {
        body.preco_ml = precoMLNum
        body.url_ml = urlML
        body.estoque = parseInt(estoque, 10)
      } else if (tipo === "tipo_b") {
        body.quantidade = parseInt(quantidadeLote, 10)
      }

      const res = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setToast({
          tipo: "erro",
          mensagem: json.error?.message ?? "Erro ao salvar produto. Tente novamente.",
        })
        return
      }

      const statusLabel: Record<string, string> = {
        rascunho: "salvo como rascunho",
        pendente: "enviado para aprovação",
        publicado: "publicado com sucesso",
      }

      setToast({
        tipo: "sucesso",
        mensagem: `Produto ${statusLabel[json.data.status] ?? "salvo"}!`,
        slug: json.data.slug,
      })

      setTimeout(() => router.push("/admin/produtos"), 2000)
    } catch {
      setToast({
        tipo: "erro",
        mensagem: "Erro de conexão. Verifique sua internet e tente novamente.",
      })
    } finally {
      setSalvando(null)
    }
  }

  const desabilitado = salvando !== null

  return (
    <>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()} noValidate>

        {/* Layout duas colunas */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Coluna esquerda — upload ── */}
          <div className="flex flex-col gap-2">
            <ImageUploadZone onChange={setImagens} />
            {erros.imagens && (
              <p className="text-xs text-red-600" role="alert">{erros.imagens}</p>
            )}
          </div>

          {/* ── Coluna direita — campos básicos ── */}
          <div className="flex flex-col gap-5">

            {/* Nome */}
            <Campo
              label="Nome do Produto"
              htmlFor="nome"
              obrigatorio
              erro={erros.nome}
            >
              <input
                id="nome"
                name="nome"
                type="text"
                maxLength={200}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex: Smart TV Samsung 55" 4K Crystal UHD'
                className={inputCls(!!erros.nome)}
              />
              <p className="text-xs text-stone-400">{nome.length}/200 caracteres</p>
            </Campo>

            {/* Especificações */}
            <Campo
              label="Especificações Técnicas"
              htmlFor="specs"
              obrigatorio
              erro={erros.specs}
              dica="Campo livre — descreva as especificações relevantes para o comprador."
            >
              <textarea
                id="specs"
                name="specs"
                rows={4}
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="Bateria 40h, Bluetooth 5.3, cancelamento de ruído, tela AMOLED 6.7'', 256GB armazenamento..."
                className={cn("resize-y", inputCls(!!erros.specs))}
              />
            </Campo>

          </div>
        </div>

        {/* ── Descrição Comercial ── */}
        <RichTextEditor onChange={setDescricao} nome={nome} specs={specs} />
        {erros.descricao && (
          <p className="-mt-6 text-xs text-red-600" role="alert">{erros.descricao}</p>
        )}

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
          {erros.tipo && <p className="text-xs text-red-600" role="alert">{erros.tipo}</p>}
        </div>

        {/* ── Campos condicionais — Tipo A ── */}
        {tipo === "tipo_a" && (
          <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-700">
              Precificação — Produto Individual
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Preço ML */}
              <Campo
                label="Preço no Mercado Livre"
                htmlFor="preco_ml"
                obrigatorio
                erro={erros.precoML}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                    R$
                  </span>
                  <input
                    id="preco_ml"
                    name="preco_ml"
                    type="text"
                    inputMode="numeric"
                    value={precoMLFormatado}
                    onChange={(e) => setPrecoMLFormatado(formatarMoeda(e.target.value))}
                    placeholder="0,00"
                    className={cn("w-full pl-9 pr-3", inputCls(!!erros.precoML))}
                  />
                </div>
              </Campo>

              {/* Preço Site (readonly) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-stone-700">Preço no Site (−18% automático)</span>
                <div className={cn(
                  "flex min-h-[42px] items-center gap-2 rounded-lg border px-3 py-2.5",
                  precoSite !== null
                    ? "border-green-200 bg-green-50"
                    : "border-stone-200 bg-stone-50"
                )}>
                  {precoSite !== null ? (
                    <span className="text-lg font-bold text-green-700">{BRL.format(precoSite)}</span>
                  ) : (
                    <span className="text-sm text-stone-400">Informe o preço ML para calcular</span>
                  )}
                </div>
                {economia !== null && (
                  <p className="text-xs font-medium text-green-700">
                    O cliente economiza {BRL.format(economia)} comprando pelo site
                  </p>
                )}
                {!economia && (
                  <p className="text-xs text-stone-400">Fórmula: Preço ML × 0,82</p>
                )}
              </div>
            </div>

            {/* URL do ML */}
            <Campo
              label="URL do produto no Mercado Livre"
              htmlFor="url_ml"
              obrigatorio
              erro={erros.urlML}
              dica="Cole o link direto do anúncio no Mercado Livre"
            >
              <input
                id="url_ml"
                name="url_ml"
                type="url"
                value={urlML}
                onChange={(e) => setUrlML(e.target.value)}
                placeholder="https://www.mercadolivre.com.br/..."
                className={inputCls(!!erros.urlML)}
              />
            </Campo>
          </div>
        )}

        {/* ── Campos condicionais — Tipo B ── */}
        {tipo === "tipo_b" && (
          <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-700">Detalhes do Lote</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Quantidade do lote */}
              <Campo
                label="Quantidade de Itens no Lote"
                htmlFor="quantidade_lote"
                obrigatorio
                erro={erros.quantidadeLote}
                dica="Quantidade fixa — não pode ser alterada pelo comprador."
              >
                <div className="relative">
                  <input
                    id="quantidade_lote"
                    name="quantidade_lote"
                    type="number"
                    min="1"
                    step="1"
                    value={quantidadeLote}
                    onChange={(e) => setQuantidadeLote(e.target.value)}
                    placeholder="Ex: 50"
                    className={cn("w-full pr-20", inputCls(!!erros.quantidadeLote))}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                    unidades
                  </span>
                </div>
              </Campo>

              {/* Preço sob consulta */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-stone-700">Preço</span>
                <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <MessageCircle size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="text-sm font-semibold text-amber-700">
                    Preço sob consulta — negociação via WhatsApp
                  </span>
                </div>
                <p className="text-xs text-stone-400">Sem preço fixo para lotes.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Campos comuns ── */}
        {tipo !== null && (
          <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-700">Informações Adicionais</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Categoria */}
              <Campo
                label="Categoria"
                htmlFor="categoria"
                obrigatorio
                erro={erros.categoria}
              >
                <select
                  id="categoria"
                  name="categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={inputCls(!!erros.categoria)}
                >
                  <option value="">Selecione uma categoria</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Campo>

              {/* Estoque (só Tipo A) */}
              {tipo === "tipo_a" && (
                <Campo
                  label="Estoque Disponível"
                  htmlFor="estoque"
                  obrigatorio
                  erro={erros.estoque}
                  dica="Quantidade de unidades disponíveis para venda."
                >
                  <div className="relative">
                    <input
                      id="estoque"
                      name="estoque"
                      type="number"
                      min="0"
                      step="1"
                      value={estoque}
                      onChange={(e) => setEstoque(e.target.value)}
                      placeholder="Ex: 10"
                      className={cn("w-full pr-20", inputCls(!!erros.estoque))}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                      unidades
                    </span>
                  </div>
                </Campo>
              )}
            </div>
          </div>
        )}

        {/* ── Botões de ação ── */}
        <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:justify-end">

          {/* Cancelar */}
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => router.push("/admin/produtos")}
            className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>

          {/* Salvar Rascunho — qualquer role */}
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => salvar("rascunho")}
            className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {salvando === "rascunho"
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              : "Salvar Rascunho"
            }
          </button>

          {/* Botão principal — Master ou Auxiliar */}
          {isMaster ? (
            <button
              type="button"
              disabled={desabilitado}
              onClick={() => salvar("publicado")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition",
                desabilitado
                  ? "cursor-not-allowed bg-amber-700 opacity-50"
                  : "bg-amber-700 hover:bg-amber-800"
              )}
            >
              {salvando === "publicado"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Publicando...</>
                : "Publicar Produto"
              }
            </button>
          ) : (
            <button
              type="button"
              disabled={desabilitado}
              onClick={() => salvar("pendente")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition",
                desabilitado
                  ? "cursor-not-allowed bg-amber-700 opacity-50"
                  : "bg-amber-700 hover:bg-amber-800"
              )}
            >
              {salvando === "pendente"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                : "Enviar para Aprovação"
              }
            </button>
          )}

        </div>

      </form>
    </>
  )
}
