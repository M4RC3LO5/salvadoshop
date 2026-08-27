"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Camera,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  SkipForward,
  Tag as TagIcon,
  PackageX,
} from "lucide-react"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoCaptura = "etiqueta" | "item_avulso"
type NivelConfianca = "alta" | "media" | "baixa"

type CampoChave =
  | "nome"
  | "marca"
  | "sku"
  | "ean"
  | "qtd_embalagem"
  | "lote"
  | "validade"

interface CamposApi {
  nome: string | null
  marca: string | null
  sku: string | null
  ean: string | null
  qtd_embalagem: number | null
  lote: string | null
  validade: string | null
}

interface CamposFormulario {
  nome: string
  marca: string
  sku: string
  ean: string
  qtd_embalagem: string
  num_caixas: string
  lote: string
  validade: string
  estado: string
  estado_livre: string
  observacoes: string
  custo_unitario: string
  origem: string
  fornecedor: string
}

const CAMPOS_VAZIOS: CamposFormulario = {
  nome: "",
  marca: "",
  sku: "",
  ean: "",
  qtd_embalagem: "1",
  num_caixas: "1",
  lote: "",
  validade: "",
  estado: "",
  estado_livre: "",
  observacoes: "",
  custo_unitario: "",
  origem: "",
  fornecedor: "",
}

const OPCOES_ESTADO = [
  { value: "", label: "Selecione" },
  { value: "lacrado", label: "Lacrado" },
  { value: "avaria_leve", label: "Avaria leve" },
  { value: "avaria_grave", label: "Avaria grave" },
  { value: "sucata", label: "Sucata" },
] as const

const OPCOES_ORIGEM = [
  { value: "", label: "Selecione" },
  { value: "sinistro", label: "Sinistro" },
  { value: "fabricante", label: "Fabricante" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "atacado", label: "Atacado" },
  { value: "avulso", label: "Avulso" },
] as const

// ── Conversão da foto para JPEG via canvas ──────────────────────────────────
// Resolve HEIC do iPhone e reduz o tamanho do upload (máx. 1600px, qualidade 0.85)

const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

function converterParaJpeg(arquivo: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()

    leitor.onload = () => {
      const img = new Image()

      img.onload = () => {
        const ladoMaior = Math.max(img.width, img.height)
        const escala = ladoMaior > LADO_MAXIMO ? LADO_MAXIMO / ladoMaior : 1
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)

        const canvas = document.createElement("canvas")
        canvas.width = largura
        canvas.height = altura

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."))
          return
        }

        ctx.drawImage(img, 0, 0, largura, altura)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Não foi possível converter a imagem."))
              return
            }
            resolve(new File([blob], "foto.jpg", { type: "image/jpeg" }))
          },
          "image/jpeg",
          QUALIDADE_JPEG
        )
      }

      img.onerror = () => reject(new Error("Não foi possível abrir a imagem capturada."))
      img.src = leitor.result as string
    }

    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."))
    leitor.readAsDataURL(arquivo)
  })
}

// ── Badge de confiança ───────────────────────────────────────────────────────

function BadgeConfianca({ nivel }: { nivel: NivelConfianca }) {
  const config: Record<NivelConfianca, { label: string; cls: string; Icone: typeof AlertTriangle | null }> = {
    alta: { label: "Alta confiança", cls: "bg-green-100 text-green-700", Icone: CheckCircle2 },
    media: { label: "Confira este dado", cls: "bg-amber-100 text-amber-800", Icone: AlertTriangle },
    baixa: { label: "Confira este dado", cls: "bg-red-100 text-red-700", Icone: AlertTriangle },
  }
  const { label, cls, Icone } = config[nivel]

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {Icone && <Icone className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  )
}

// ── Campo do formulário com destaque de IA ──────────────────────────────────

interface CampoProps {
  label: string
  htmlFor: string
  obrigatorio?: boolean
  erro?: string
  destaqueIA?: boolean
  nivelConfianca?: NivelConfianca
  children: React.ReactNode
}

function Campo({ label, htmlFor, obrigatorio, erro, destaqueIA, nivelConfianca, children }: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
          {label}
          {obrigatorio && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
        {destaqueIA && nivelConfianca && <BadgeConfianca nivel={nivelConfianca} />}
      </div>
      {children}
      {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
    </div>
  )
}

function inputCls(opts: { erro?: boolean; destaque?: boolean } = {}) {
  return cn(
    "w-full rounded-lg border px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:ring-2",
    opts.erro
      ? "border-red-400 focus:border-red-400 focus:ring-red-200"
      : opts.destaque
        ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-200 focus:border-amber-700 focus:ring-amber-700/20"
        : "border-stone-300 focus:border-amber-700 focus:ring-amber-700/20"
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function CapturarTriagemPage() {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [tipoCaptura, setTipoCaptura] = useState<TipoCaptura | null>(null)

  // Etapa 2 — câmera
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [fotoConvertida, setFotoConvertida] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [convertendo, setConvertendo] = useState(false)
  const [erroFoto, setErroFoto] = useState("")
  const [processando, setProcessando] = useState(false)
  const [erroProcessamento, setErroProcessamento] = useState("")

  // Etapa 3 — formulário
  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS)
  const [origemIA, setOrigemIA] = useState<Set<CampoChave>>(new Set())
  const [confianca, setConfianca] = useState<Partial<Record<CampoChave, NivelConfianca>>>({})
  const [submetido, setSubmetido] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState("")

  // Lista de triagem em andamento — itens seguintes caem na mesma lista
  const [listaId, setListaId] = useState<string | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState("")

  useEffect(() => {
    if (!mensagemSucesso) return
    const t = setTimeout(() => setMensagemSucesso(""), 3500)
    return () => clearTimeout(t)
  }, [mensagemSucesso])

  // ── Etapa 1 ──
  function escolherTipoCaptura(tipo: TipoCaptura) {
    setTipoCaptura(tipo)
    setEtapa(2)
  }

  // ── Etapa 2 ──
  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ""
    if (!arquivo) return

    setErroFoto("")
    setConvertendo(true)
    try {
      const convertida = await converterParaJpeg(arquivo)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setFotoConvertida(convertida)
      setPreviewUrl(URL.createObjectURL(convertida))
    } catch {
      setErroFoto("Não foi possível processar a foto. Tente novamente.")
    } finally {
      setConvertendo(false)
    }
  }

  function refazerFoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFotoConvertida(null)
    setPreviewUrl(null)
    setErroFoto("")
    setErroProcessamento("")
  }

  function aplicarCamposExtraidos(camposApi: CamposApi, confiancaApi: Partial<Record<CampoChave, NivelConfianca>>) {
    setCampos((prev) => ({
      ...prev,
      nome: camposApi.nome ?? prev.nome,
      marca: camposApi.marca ?? prev.marca,
      sku: camposApi.sku ?? prev.sku,
      ean: camposApi.ean ?? prev.ean,
      qtd_embalagem: camposApi.qtd_embalagem != null ? String(camposApi.qtd_embalagem) : prev.qtd_embalagem,
      lote: camposApi.lote ?? prev.lote,
      validade: camposApi.validade ?? prev.validade,
    }))

    const chaves: CampoChave[] = ["nome", "marca", "sku", "ean", "qtd_embalagem", "lote", "validade"]
    const novaOrigem = new Set<CampoChave>()
    chaves.forEach((chave) => {
      if (camposApi[chave] !== null && camposApi[chave] !== undefined) novaOrigem.add(chave)
    })
    setOrigemIA(novaOrigem)
    setConfianca(confiancaApi)
  }

  async function processarFoto() {
    if (!fotoConvertida || !tipoCaptura) return

    setProcessando(true)
    setErroProcessamento("")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const formData = new FormData()
      formData.append("foto", fotoConvertida)
      formData.append("tipo_captura", tipoCaptura)

      const res = await fetch("/api/triagem/extrair", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setErroProcessamento(json.error?.message ?? "Não foi possível extrair os dados da foto.")
        return
      }

      aplicarCamposExtraidos(json.data.campos, json.data.confianca)
      setEtapa(3)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setErroProcessamento("Erro de conexão. Preencha os dados manualmente.")
    } finally {
      setProcessando(false)
    }
  }

  function preencherManualmente() {
    abortRef.current?.abort()
    setProcessando(false)
    setOrigemIA(new Set())
    setConfianca({})
    setEtapa(3)
  }

  // ── Etapa 3 ──
  function atualizarCampo<K extends keyof CamposFormulario>(campo: K, valor: string) {
    setCampos((prev) => ({ ...prev, [campo]: valor }))
    setOrigemIA((prev) => {
      if (!prev.has(campo as CampoChave)) return prev
      const novo = new Set(prev)
      novo.delete(campo as CampoChave)
      return novo
    })
  }

  const qtdEmbalagemNum = Math.max(1, parseInt(campos.qtd_embalagem, 10) || 1)
  const numCaixasNum = Math.max(1, parseInt(campos.num_caixas, 10) || 1)
  const totalUnidades = qtdEmbalagemNum * numCaixasNum

  const erroNome = submetido && !campos.nome.trim() ? "Informe o nome do produto." : ""
  const formValido = campos.nome.trim().length > 0

  async function concluirTriagem() {
    setSubmetido(true)
    setErroSalvar("")
    if (!formValido) return

    if (!fotoConvertida || !tipoCaptura) {
      setErroSalvar("Foto não encontrada. Volte e capture a foto novamente.")
      return
    }

    setSalvando(true)
    try {
      const formData = new FormData()
      formData.append("nome", campos.nome)
      formData.append("marca", campos.marca)
      formData.append("sku", campos.sku)
      formData.append("ean", campos.ean)
      formData.append("qtd_embalagem", campos.qtd_embalagem)
      formData.append("num_caixas", campos.num_caixas)
      formData.append("lote", campos.lote)
      formData.append("validade", campos.validade)
      formData.append("estado", campos.estado)
      formData.append("estado_livre", campos.estado_livre)
      formData.append("observacoes", campos.observacoes)
      formData.append("custo_unitario", campos.custo_unitario)
      formData.append("origem", campos.origem)
      formData.append("fornecedor", campos.fornecedor)
      formData.append("tipo_captura", tipoCaptura)
      formData.append("campos_ia", JSON.stringify(montarCamposIA()))
      if (listaId) formData.append("lista_id", listaId)

      const res = await fetch("/api/triagem/itens", { method: "POST", body: formData })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setErroSalvar(json.error?.message ?? "Não foi possível salvar o item. Tente novamente.")
        return
      }

      setListaId(json.data.lista_id)
      setMensagemSucesso("Item salvo")
      iniciarProximoItem()
    } catch {
      setErroSalvar("Erro de conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  function montarCamposIA() {
    const resultado: Record<string, { valor: string; confianca: NivelConfianca | null }> = {}
    origemIA.forEach((chave) => {
      resultado[chave] = { valor: campos[chave], confianca: confianca[chave] ?? null }
    })
    return resultado
  }

  // Volta à etapa 1 com o formulário limpo, mantendo a lista de triagem em andamento
  function iniciarProximoItem() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setEtapa(1)
    setTipoCaptura(null)
    setFotoConvertida(null)
    setPreviewUrl(null)
    setErroFoto("")
    setErroProcessamento("")
    setCampos(CAMPOS_VAZIOS)
    setOrigemIA(new Set())
    setConfianca({})
    setSubmetido(false)
    setErroSalvar("")
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-10">

      <div className="border-b border-stone-200 pb-4">
        <Link
          href="/admin/triagem"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a lista
        </Link>
      </div>

      {/* Cabeçalho com progresso */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Triagem de Estoque</h1>
        <div className="mt-3 flex items-center gap-2" aria-label={`Etapa ${etapa} de 3`}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                n <= etapa ? "bg-amber-700" : "bg-stone-200"
              )}
            />
          ))}
        </div>
        {listaId && (
          <p className="mt-2 text-xs text-stone-400">Adicionando itens à lista de triagem em andamento.</p>
        )}
      </div>

      {mensagemSucesso && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {mensagemSucesso}
        </div>
      )}

      {/* ── Etapa 1 — Pergunta inicial ── */}
      {etapa === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-stone-600">O produto tem etiqueta com informações legíveis?</p>

          <button
            type="button"
            onClick={() => escolherTipoCaptura("etiqueta")}
            className="flex min-h-[44px] items-center gap-4 rounded-xl border-2 border-stone-200 bg-white p-5 text-left transition hover:border-amber-400 hover:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-700 text-white">
              <TagIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-stone-800">Tem etiqueta</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Fotografe a etiqueta para extrair marca, SKU, lote e validade automaticamente.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => escolherTipoCaptura("item_avulso")}
            className="flex min-h-[44px] items-center gap-4 rounded-xl border-2 border-stone-200 bg-white p-5 text-left transition hover:border-amber-400 hover:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-stone-600 text-white">
              <PackageX className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-stone-800">Sem etiqueta</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Item avulso — a IA tenta reconhecer nome, marca, SKU e EAN pela foto do produto.
              </p>
            </div>
          </button>
        </div>
      )}

      {/* ── Etapa 2 — Câmera ── */}
      {etapa === 2 && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setEtapa(1)}
            className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Etapa anterior
          </button>

          <input
            ref={inputRef}
            id="input-foto-triagem"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={aoSelecionarArquivo}
            className="sr-only"
          />

          {!previewUrl && (
            <label
              htmlFor="input-foto-triagem"
              className={cn(
                "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-white text-center transition hover:border-amber-400 hover:bg-amber-50/30",
                convertendo && "pointer-events-none opacity-60"
              )}
            >
              {convertendo ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-amber-700" aria-hidden="true" />
                  <span className="text-sm font-medium text-stone-600">Processando foto...</span>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white">
                    <Camera className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="min-h-[44px] px-4 py-2 text-sm font-semibold text-stone-700">
                    Tirar Foto
                  </span>
                </>
              )}
            </label>
          )}

          {erroFoto && <p className="text-sm text-red-600" role="alert">{erroFoto}</p>}

          {previewUrl && (
            <div className="flex flex-col gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Pré-visualização da foto capturada"
                className="max-h-[420px] w-full rounded-xl border border-stone-200 object-contain"
              />

              {erroProcessamento && (
                <p className="text-sm text-red-600" role="alert">{erroProcessamento}</p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={refazerFoto}
                  disabled={processando}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Refazer
                </button>
                <button
                  type="button"
                  onClick={processarFoto}
                  disabled={processando}
                  className={cn(
                    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition",
                    processando ? "cursor-not-allowed bg-amber-700 opacity-70" : "bg-amber-700 hover:bg-amber-800"
                  )}
                >
                  {processando
                    ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processando...</>
                    : "Processar"
                  }
                </button>
              </div>

              {processando && (
                <button
                  type="button"
                  onClick={preencherManualmente}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 text-sm font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" /> Preencher manualmente
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3 — Formulário ── */}
      {etapa === 3 && (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setEtapa(2)}
            className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Etapa anterior
          </button>

          {origemIA.size > 0 && (
            <p className="text-xs text-stone-500">
              Campos com borda âmbar foram preenchidos pela IA. Edite qualquer um deles para assumir o dado manualmente.
            </p>
          )}

          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
            <Campo
              label="Nome do Produto"
              htmlFor="nome"
              obrigatorio
              erro={erroNome}
              destaqueIA={origemIA.has("nome")}
              nivelConfianca={confianca.nome}
            >
              <input
                id="nome"
                type="text"
                value={campos.nome}
                onChange={(e) => atualizarCampo("nome", e.target.value)}
                placeholder="Ex: Fone de Ouvido Bluetooth"
                className={inputCls({ erro: !!erroNome, destaque: origemIA.has("nome") })}
              />
            </Campo>

            <Campo
              label="Marca"
              htmlFor="marca"
              destaqueIA={origemIA.has("marca")}
              nivelConfianca={confianca.marca}
            >
              <input
                id="marca"
                type="text"
                value={campos.marca}
                onChange={(e) => atualizarCampo("marca", e.target.value)}
                placeholder="Ex: Samsung"
                className={inputCls({ destaque: origemIA.has("marca") })}
              />
            </Campo>

            <Campo
              label="SKU"
              htmlFor="sku"
              destaqueIA={origemIA.has("sku")}
              nivelConfianca={confianca.sku}
            >
              <input
                id="sku"
                type="text"
                value={campos.sku}
                onChange={(e) => atualizarCampo("sku", e.target.value)}
                placeholder="Código interno do fabricante"
                className={inputCls({ destaque: origemIA.has("sku") })}
              />
            </Campo>

            <Campo
              label="EAN"
              htmlFor="ean"
              destaqueIA={origemIA.has("ean")}
              nivelConfianca={confianca.ean}
            >
              <input
                id="ean"
                type="text"
                inputMode="numeric"
                value={campos.ean}
                onChange={(e) => atualizarCampo("ean", e.target.value)}
                placeholder="Código de barras"
                className={inputCls({ destaque: origemIA.has("ean") })}
              />
            </Campo>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo
                label="Qtd. por Embalagem"
                htmlFor="qtd_embalagem"
                destaqueIA={origemIA.has("qtd_embalagem")}
                nivelConfianca={confianca.qtd_embalagem}
              >
                <input
                  id="qtd_embalagem"
                  type="number"
                  min={1}
                  step={1}
                  value={campos.qtd_embalagem}
                  onChange={(e) => atualizarCampo("qtd_embalagem", e.target.value)}
                  className={inputCls({ destaque: origemIA.has("qtd_embalagem") })}
                />
              </Campo>

              <Campo label="Nº de Caixas" htmlFor="num_caixas">
                <input
                  id="num_caixas"
                  type="number"
                  min={1}
                  step={1}
                  value={campos.num_caixas}
                  onChange={(e) => atualizarCampo("num_caixas", e.target.value)}
                  className={inputCls()}
                />
              </Campo>
            </div>

            {/* Total de unidades — calculado */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Total de Unidades</span>
              <div className="flex min-h-[42px] items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <span className="text-lg font-bold text-stone-800">{totalUnidades}</span>
                <span className="ml-2 text-xs text-stone-400">
                  {qtdEmbalagemNum} por embalagem × {numCaixasNum} caixa(s)
                </span>
              </div>
            </div>

            {tipoCaptura === "etiqueta" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo
                  label="Lote"
                  htmlFor="lote"
                  destaqueIA={origemIA.has("lote")}
                  nivelConfianca={confianca.lote}
                >
                  <input
                    id="lote"
                    type="text"
                    value={campos.lote}
                    onChange={(e) => atualizarCampo("lote", e.target.value)}
                    placeholder="Código do lote"
                    className={inputCls({ destaque: origemIA.has("lote") })}
                  />
                </Campo>

                <Campo
                  label="Validade"
                  htmlFor="validade"
                  destaqueIA={origemIA.has("validade")}
                  nivelConfianca={confianca.validade}
                >
                  <input
                    id="validade"
                    type="date"
                    value={campos.validade}
                    onChange={(e) => atualizarCampo("validade", e.target.value)}
                    className={inputCls({ destaque: origemIA.has("validade") })}
                  />
                </Campo>
              </div>
            )}

            {/* ── Dados complementares — nunca vêm da IA ── */}
            <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-stone-700">Dados complementares (opcional)</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Estado do Item" htmlFor="estado">
                  <select
                    id="estado"
                    value={campos.estado}
                    onChange={(e) => atualizarCampo("estado", e.target.value)}
                    className={inputCls()}
                  >
                    {OPCOES_ESTADO.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                    ))}
                  </select>
                </Campo>

                <Campo label="Estado — Descrição Livre" htmlFor="estado_livre">
                  <input
                    id="estado_livre"
                    type="text"
                    value={campos.estado_livre}
                    onChange={(e) => atualizarCampo("estado_livre", e.target.value)}
                    placeholder="Detalhe a condição, se necessário"
                    className={inputCls()}
                  />
                </Campo>
              </div>

              <Campo label="Observações" htmlFor="observacoes">
                <textarea
                  id="observacoes"
                  rows={3}
                  value={campos.observacoes}
                  onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                  className={cn("resize-y", inputCls())}
                />
              </Campo>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Custo Unitário" htmlFor="custo_unitario">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                      R$
                    </span>
                    <input
                      id="custo_unitario"
                      type="number"
                      step={0.01}
                      min={0}
                      value={campos.custo_unitario}
                      onChange={(e) => atualizarCampo("custo_unitario", e.target.value)}
                      className={cn("pl-9", inputCls())}
                    />
                  </div>
                </Campo>

                <Campo label="Origem" htmlFor="origem">
                  <select
                    id="origem"
                    value={campos.origem}
                    onChange={(e) => atualizarCampo("origem", e.target.value)}
                    className={inputCls()}
                  >
                    {OPCOES_ORIGEM.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              <Campo label="Fornecedor / Seguradora" htmlFor="fornecedor">
                <input
                  id="fornecedor"
                  type="text"
                  value={campos.fornecedor}
                  onChange={(e) => atualizarCampo("fornecedor", e.target.value)}
                  className={inputCls()}
                />
              </Campo>
            </div>

            {erroSalvar && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {erroSalvar}
              </div>
            )}

            <button
              type="button"
              onClick={concluirTriagem}
              disabled={salvando}
              className={cn(
                "mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition",
                salvando ? "cursor-not-allowed bg-amber-700 opacity-70" : "bg-amber-700 hover:bg-amber-800"
              )}
            >
              {salvando
                ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando...</>
                : "Concluir Triagem"
              }
            </button>
          </form>
        </div>
      )}

    </div>
  )
}
