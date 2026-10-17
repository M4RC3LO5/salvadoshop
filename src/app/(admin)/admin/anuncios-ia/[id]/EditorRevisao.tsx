"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"

export interface ImagemRevisao {
  url: string
  tipo?: string
}

interface Especificacao {
  nome: string
  valor: string
  origem: "foto" | "print_pedido" | "manual"
}

export interface DadosRevisao {
  nome: string | null
  marca: string | null
  modelo: string | null
  codigo: string | null
  categoria_id: string | null
  especificacoes: Especificacao[]
  conteudo_embalagem: string[]
  descricao_html: string | null
  nao_confirmado: string[]
  pedido: {
    titulo_anuncio_origem: string | null
    valor_pago: number | null
    moeda: string | null
    quantidade: number | null
  } | null
}

interface Props {
  anuncioId: string
  imagens: ImagemRevisao[]
  categorias: { id: string; nome: string }[]
  custo: number | null
  dados: DadosRevisao
}

const LIMITE_NOME = 60

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"

// Texto puro a partir do HTML permitido (p, ul, li, strong) — nunca renderizado como HTML.
function descricaoParaTexto(html: string | null): string {
  if (!html) return ""
  return html
    .replace(/<\/(p|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatCusto(valor: number) {
  return `US$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}

function formatValorPago(valor: number | null, moeda: string | null) {
  if (valor === null) return "—"
  const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return moeda ? `${moeda} ${numero}` : numero
}

export function EditorRevisao({ anuncioId, imagens, categorias, custo, dados }: Props) {
  const router = useRouter()

  const [nome, setNome] = useState(dados.nome ?? "")
  const [categoriaId, setCategoriaId] = useState(dados.categoria_id ?? "")
  const [marca, setMarca] = useState(dados.marca ?? "")
  const [modelo, setModelo] = useState(dados.modelo ?? "")
  const [codigo, setCodigo] = useState(dados.codigo ?? "")
  const [specs, setSpecs] = useState<Especificacao[]>(dados.especificacoes)
  const [embalagem, setEmbalagem] = useState(dados.conteudo_embalagem.join("\n"))

  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const descartandoRef = useRef(false)

  const fotos = imagens.filter((i) => i.tipo !== "print_pedido")
  const prints = imagens.filter((i) => i.tipo === "print_pedido")
  const descricaoTexto = descricaoParaTexto(dados.descricao_html)
  const ocupado = salvando || descartando

  function atualizarSpec(indice: number, campo: "nome" | "valor", valor: string) {
    setSpecs((prev) => prev.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)))
  }

  function removerSpec(indice: number) {
    setSpecs((prev) => prev.filter((_, i) => i !== indice))
  }

  function adicionarSpec() {
    setSpecs((prev) => [...prev, { nome: "", valor: "", origem: "manual" }])
  }

  async function salvar() {
    if (salvandoRef.current || descartandoRef.current) return
    setMensagem("")
    setErro("")

    if (!nome.trim()) {
      setErro("Informe o nome do produto.")
      return
    }

    // Linhas totalmente vazias são ignoradas; meio preenchidas pedem correção.
    const specsPreenchidas = specs.filter((s) => s.nome.trim() || s.valor.trim())
    if (specsPreenchidas.some((s) => !s.nome.trim() || !s.valor.trim())) {
      setErro("Preencha o nome e o valor de cada especificação, ou remova a linha.")
      return
    }

    salvandoRef.current = true
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/anuncios-ia/${anuncioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar",
          dados: {
            nome: nome.trim(),
            marca: marca.trim() || null,
            modelo: modelo.trim() || null,
            codigo: codigo.trim() || null,
            categoria_id: categoriaId || null,
            especificacoes: specsPreenchidas.map((s) => ({
              nome: s.nome.trim(),
              valor: s.valor.trim(),
              origem: s.origem,
            })),
            conteudo_embalagem: embalagem
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          },
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Não foi possível salvar. Tente novamente.")
        return
      }
      // O servidor remove especificações repetidas; reflete isso na tela.
      if (Array.isArray(json.data?.especificacoes)) setSpecs(json.data.especificacoes)
      setMensagem("Alterações salvas")
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  async function descartar() {
    if (descartandoRef.current || salvandoRef.current) return
    setMensagem("")
    setErro("")
    descartandoRef.current = true
    setDescartando(true)
    try {
      const res = await fetch(`/api/admin/anuncios-ia/${anuncioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "descartar" }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Não foi possível descartar. Tente novamente.")
        setConfirmandoDescarte(false)
        return
      }
      router.push("/admin/anuncios-ia")
    } catch {
      setErro("Erro de conexão. Tente novamente.")
      setConfirmandoDescarte(false)
    } finally {
      descartandoRef.current = false
      setDescartando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="space-y-2">
        <Link href="/admin/anuncios-ia" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a fila
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Revisar anúncio</h1>
          {custo !== null && <p className="text-xs text-gray-500">Custo IA: {formatCusto(custo)}</p>}
        </div>
      </div>

      {/* Fotos */}
      {(fotos.length > 0 || prints.length > 0) && (
        <section aria-label="Fotos do anúncio">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((img, i) => (
              <li key={img.url} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image src={img.url} alt={`Foto ${i + 1} do produto`} fill sizes="(min-width: 640px) 160px, 33vw" className="object-cover" />
              </li>
            ))}
            {prints.map((img, i) => (
              <li key={img.url} className="space-y-1">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-red-200 bg-gray-100">
                  <Image src={img.url} alt={`Print do pedido ${i + 1}`} fill sizes="(min-width: 640px) 160px, 33vw" className="object-cover" />
                </div>
                <p className="text-xs font-medium text-red-700">Print do pedido</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="nome" className="text-sm font-medium text-gray-700">Nome</label>
            <span className={`text-xs ${nome.length > LIMITE_NOME ? "text-red-600" : "text-gray-500"}`}>
              {nome.length}/{LIMITE_NOME}
            </span>
          </div>
          <input
            id="nome"
            type="text"
            value={nome}
            maxLength={LIMITE_NOME}
            onChange={(e) => setNome(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="categoria" className="text-sm font-medium text-gray-700">Categoria</label>
          <select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputCls}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="marca" className="text-sm font-medium text-gray-700">Marca</label>
            <input id="marca" type="text" value={marca} maxLength={120} onChange={(e) => setMarca(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="modelo" className="text-sm font-medium text-gray-700">Modelo</label>
            <input id="modelo" type="text" value={modelo} maxLength={120} onChange={(e) => setModelo(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="codigo" className="text-sm font-medium text-gray-700">Código</label>
            <input id="codigo" type="text" value={codigo} maxLength={120} onChange={(e) => setCodigo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-gray-700">Especificações</legend>
          {specs.length === 0 && <p className="text-sm text-gray-500">Nenhuma especificação.</p>}
          {specs.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <label htmlFor={`spec-nome-${i}`} className="text-xs font-medium text-gray-600">Nome</label>
                <input
                  id={`spec-nome-${i}`}
                  type="text"
                  value={s.nome}
                  maxLength={80}
                  onChange={(e) => atualizarSpec(i, "nome", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex-[2] space-y-1">
                <label htmlFor={`spec-valor-${i}`} className="text-xs font-medium text-gray-600">Valor</label>
                <input
                  id={`spec-valor-${i}`}
                  type="text"
                  value={s.valor}
                  maxLength={300}
                  onChange={(e) => atualizarSpec(i, "valor", e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => removerSpec(i)}
                aria-label={`Remover especificação ${s.nome || i + 1}`}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={adicionarSpec}
            disabled={specs.length >= 40}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar especificação
          </button>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="embalagem" className="text-sm font-medium text-gray-700">
            Conteúdo da embalagem <span className="font-normal text-gray-500">(um item por linha)</span>
          </label>
          <textarea id="embalagem" rows={4} value={embalagem} onChange={(e) => setEmbalagem(e.target.value)} className={inputCls} />
        </div>
      </form>

      {/* Não confirmado */}
      {dados.nao_confirmado.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Não confirmado — complete se souber</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {dados.nao_confirmado.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Descrição sugerida */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-800">Descrição sugerida (você poderá editar no produto)</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
          {descricaoTexto || "Sem descrição sugerida."}
        </p>
      </section>

      {/* Uso interno */}
      <section className="rounded-lg border-2 border-red-400 bg-white p-4">
        <h2 className="text-sm font-semibold text-red-800">Uso interno — não vai para o anúncio</h2>
        {dados.pedido ? (
          <dl className="mt-2 space-y-1 text-sm text-gray-800">
            <div>
              <dt className="inline font-medium">Título de origem: </dt>
              <dd className="inline">{dados.pedido.titulo_anuncio_origem ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Valor pago: </dt>
              <dd className="inline">{formatValorPago(dados.pedido.valor_pago, dados.pedido.moeda)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Quantidade: </dt>
              <dd className="inline">{dados.pedido.quantidade ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-gray-600">Sem dados do pedido</p>
        )}
      </section>

      {mensagem && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {mensagem}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={salvar}
          disabled={ocupado}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {salvando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando...</> : "Salvar"}
        </button>

        {!confirmandoDescarte ? (
          <button
            type="button"
            onClick={() => setConfirmandoDescarte(true)}
            disabled={ocupado}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-300 bg-white px-6 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Descartar
          </button>
        ) : (
          <div role="group" aria-label="Confirmar descarte" className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={descartar}
              disabled={ocupado}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
            >
              {descartando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Descartando...</> : "Confirmar descarte"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoDescarte(false)}
              disabled={descartando}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
