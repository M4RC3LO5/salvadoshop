"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Aprovacao {
  id: string
  produto_id: string
  tipo_alteracao: "criacao" | "edicao"
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown>
  status: "pendente" | "aprovado" | "rejeitado"
  motivo_rejeicao: string | null
  created_at: string
  resolved_at: string | null
  admin_usuario: { nome: string; email: string } | null
  produto: { nome: string; slug: string } | null
}

type Aba = "pendente" | "aprovado" | "rejeitado"

// ── Diff visual ───────────────────────────────────────────────────────────────

const CAMPOS_LABEL: Record<string, string> = {
  nome: "Nome",
  descricao: "Descrição",
  specs_tecnicas: "Especificações",
  tipo: "Tipo",
  categoria: "Categoria",
  preco_ml: "Preço ML",
  url_ml: "URL Mercado Livre",
  estoque: "Estoque",
  quantidade_lote: "Quantidade Lote",
}

function formatarValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined) return "—"
  if (campo === "preco_ml" && typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }
  if (campo === "specs_tecnicas" && typeof valor === "object") {
    return (valor as { texto?: string }).texto ?? JSON.stringify(valor)
  }
  if (campo === "tipo") {
    return valor === "tipo_a" ? "Produto Individual (Tipo A)" : "Lote para Revendedores (Tipo B)"
  }
  return String(valor)
}

function DiffVisual({
  anterior,
  novo,
  tipoAlteracao,
}: {
  anterior: Record<string, unknown> | null
  novo: Record<string, unknown>
  tipoAlteracao: "criacao" | "edicao"
}) {
  const camposExibir = Object.keys(CAMPOS_LABEL)

  if (tipoAlteracao === "criacao") {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
          Dados do novo produto
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {camposExibir.map((campo) => {
            const val = novo[campo]
            if (val === null || val === undefined) return null
            return (
              <div key={campo} className="rounded-md border border-green-200 bg-green-50 p-2">
                <p className="text-xs font-medium text-green-700">{CAMPOS_LABEL[campo]}</p>
                <p className="mt-0.5 text-sm text-green-900 break-words">
                  {formatarValor(campo, val)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Edição — diff lado a lado
  const camposAlterados = camposExibir.filter((campo) => {
    const a = JSON.stringify(anterior?.[campo] ?? null)
    const n = JSON.stringify(novo[campo] ?? null)
    return a !== n
  })

  const camposIguais = camposExibir.filter((campo) => {
    const a = JSON.stringify(anterior?.[campo] ?? null)
    const n = JSON.stringify(novo[campo] ?? null)
    return a === n && (anterior?.[campo] !== undefined || novo[campo] !== undefined)
  })

  return (
    <div className="space-y-3">
      {camposAlterados.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Campos alterados
          </p>
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <div className="grid grid-cols-2 divide-x divide-stone-200 bg-stone-100">
              <div className="px-3 py-1.5 text-xs font-semibold text-red-700">Antes</div>
              <div className="px-3 py-1.5 text-xs font-semibold text-green-700">Depois</div>
            </div>
            {camposAlterados.map((campo) => (
              <div
                key={campo}
                className="grid grid-cols-2 divide-x divide-stone-200 border-t border-stone-200"
              >
                <div className="bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">{CAMPOS_LABEL[campo]}</p>
                  <p className="mt-0.5 text-sm text-red-900 break-words line-through opacity-70">
                    {formatarValor(campo, anterior?.[campo] ?? null)}
                  </p>
                </div>
                <div className="bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-700">{CAMPOS_LABEL[campo]}</p>
                  <p className="mt-0.5 text-sm text-green-900 break-words">
                    {formatarValor(campo, novo[campo] ?? null)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {camposIguais.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600">
              <span className="group-open:hidden">
                <ChevronDown size={14} />
              </span>
              <span className="hidden group-open:block">
                <ChevronUp size={14} />
              </span>
              {camposIguais.length} campos sem alteração
            </span>
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {camposIguais.map((campo) => (
              <div
                key={campo}
                className="rounded-md border border-stone-200 bg-stone-50 p-2"
              >
                <p className="text-xs font-medium text-stone-500">{CAMPOS_LABEL[campo]}</p>
                <p className="mt-0.5 text-sm text-stone-700 break-words">
                  {formatarValor(campo, novo[campo])}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── Modal de rejeição ─────────────────────────────────────────────────────────

function ModalRejeicao({
  aprovacaoId,
  nomeProduto,
  onClose,
  onRejeitado,
}: {
  aprovacaoId: string
  nomeProduto: string
  onClose: () => void
  onRejeitado: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")

  async function handleRejeitar() {
    setErro("")
    if (motivo.trim().length < 10) {
      setErro("O motivo deve ter pelo menos 10 caracteres.")
      return
    }
    setCarregando(true)
    try {
      const res = await fetch(`/api/admin/aprovacoes/${aprovacaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "rejeitar", motivo: motivo.trim() }),
      })
      const json = await res.json()
      if (!json.success) {
        setErro(json.error?.message ?? "Erro ao rejeitar.")
        return
      }
      onRejeitado()
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-titulo"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 id="modal-titulo" className="text-base font-semibold text-stone-900">
            Rejeitar aprovação
          </h2>
          <p className="mt-0.5 text-sm text-stone-500 truncate">{nomeProduto}</p>
        </div>

        <div className="px-6 py-5">
          <label
            htmlFor="motivo-rejeicao"
            className="mb-1.5 block text-sm font-medium text-stone-700"
          >
            Motivo da rejeição <span className="text-red-500">*</span>
          </label>
          <textarea
            id="motivo-rejeicao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explique o que precisa ser corrigido..."
            rows={4}
            className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            aria-describedby={erro ? "erro-motivo" : undefined}
          />
          <div className="mt-1 flex items-center justify-between">
            {erro ? (
              <p id="erro-motivo" className="flex items-center gap-1 text-xs text-red-600" role="alert">
                <AlertTriangle size={12} />
                {erro}
              </p>
            ) : (
              <p className="text-xs text-stone-400">{motivo.length}/10 caracteres mínimos</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={carregando}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleRejeitar}
            disabled={carregando || motivo.trim().length < 10}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {carregando && <Loader2 size={14} className="animate-spin" />}
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de aprovação ─────────────────────────────────────────────────────────

function CardAprovacao({
  aprovacao,
  onAtualizar,
}: {
  aprovacao: Aprovacao
  onAtualizar: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const [aprovando, setAprovando] = useState(false)
  const [modalRejeicao, setModalRejeicao] = useState(false)

  const nomeProduto = aprovacao.produto?.nome ?? aprovacao.dados_novos?.nome as string ?? "Produto"
  const slug = aprovacao.produto?.slug ?? ""
  const enviador = aprovacao.admin_usuario?.nome ?? aprovacao.admin_usuario?.email ?? "Desconhecido"
  const dataEnvio = new Date(aprovacao.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  async function handleAprovar() {
    setAprovando(true)
    try {
      const res = await fetch(`/api/admin/aprovacoes/${aprovacao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "aprovar" }),
      })
      const json = await res.json()
      if (json.success) {
        onAtualizar()
      }
    } catch {
      // erro silencioso — usuário pode tentar novamente
    } finally {
      setAprovando(false)
    }
  }

  const corTipo =
    aprovacao.tipo_alteracao === "criacao"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700"

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Cabeçalho do card */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-stone-900">{nomeProduto}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corTipo}`}>
                {aprovacao.tipo_alteracao === "criacao" ? "Criação" : "Edição"}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {dataEnvio}
              </span>
              <span>Enviado por <strong className="font-medium text-stone-700">{enviador}</strong></span>
            </p>
          </div>

          {/* Botão visualizar */}
          {slug && (
            <a
              href={`/produto/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              <ExternalLink size={13} />
              Visualizar produto
            </a>
          )}
        </div>

        {/* Diff — expansível */}
        <div className="px-5 py-4">
          <button
            onClick={() => setExpandido((v) => !v)}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
            aria-expanded={expandido}
          >
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expandido ? "Ocultar alterações" : "Ver alterações"}
          </button>

          {expandido && (
            <DiffVisual
              anterior={aprovacao.dados_anteriores}
              novo={aprovacao.dados_novos}
              tipoAlteracao={aprovacao.tipo_alteracao}
            />
          )}
        </div>

        {/* Motivo de rejeição (se houver) */}
        {aprovacao.status === "rejeitado" && aprovacao.motivo_rejeicao && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-3">
            <p className="text-xs font-semibold text-red-700">Motivo da rejeição</p>
            <p className="mt-0.5 text-sm text-red-800">{aprovacao.motivo_rejeicao}</p>
          </div>
        )}

        {/* Ações — apenas para pendentes */}
        {aprovacao.status === "pendente" && (
          <div className="flex justify-end gap-3 border-t border-stone-100 bg-stone-50 px-5 py-3">
            <button
              onClick={() => setModalRejeicao(true)}
              disabled={aprovando}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={15} />
              Rejeitar
            </button>
            <button
              onClick={handleAprovar}
              disabled={aprovando}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {aprovando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle size={15} />
              )}
              Aprovar
            </button>
          </div>
        )}

        {/* Status resolvido */}
        {aprovacao.status !== "pendente" && aprovacao.resolved_at && (
          <div className="border-t border-stone-100 px-5 py-2.5">
            <p className="text-xs text-stone-400">
              {aprovacao.status === "aprovado" ? "Aprovado" : "Rejeitado"} em{" "}
              {new Date(aprovacao.resolved_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </article>

      {modalRejeicao && (
        <ModalRejeicao
          aprovacaoId={aprovacao.id}
          nomeProduto={nomeProduto}
          onClose={() => setModalRejeicao(false)}
          onRejeitado={() => {
            setModalRejeicao(false)
            onAtualizar()
          }}
        />
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AprovacoesPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<Aba>("pendente")
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [contadores, setContadores] = useState({ pendente: 0, aprovado: 0, rejeitado: 0 })

  const carregarAprovacoes = useCallback(async () => {
    setCarregando(true)
    const supabase = createClient()

    const { data } = await supabase
      .from("aprovacoes")
      .select(`
        id, produto_id, tipo_alteracao, dados_anteriores, dados_novos,
        status, motivo_rejeicao, created_at, resolved_at,
        admin_usuario:admin_usuarios!admin_id ( nome, email ),
        produto:produtos!produto_id ( nome, slug )
      `)
      .order("created_at", { ascending: false })

    const lista = (data ?? []) as unknown as Aprovacao[]
    setAprovacoes(lista)

    setContadores({
      pendente: lista.filter((a) => a.status === "pendente").length,
      aprovado: lista.filter((a) => a.status === "aprovado").length,
      rejeitado: lista.filter((a) => a.status === "rejeitado").length,
    })

    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarAprovacoes()
  }, [carregarAprovacoes])

  // Após ação, recarrega e router.refresh() para atualizar o badge da sidebar
  function handleAtualizar() {
    carregarAprovacoes()
    router.refresh()
  }

  const listaFiltrada = aprovacoes.filter((a) => a.status === abaAtiva)

  const abas: { id: Aba; label: string }[] = [
    { id: "pendente", label: "Pendentes" },
    { id: "aprovado", label: "Aprovados" },
    { id: "rejeitado", label: "Rejeitados" },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Fila de aprovações</h1>
        <p className="mt-1 text-sm text-stone-500">
          Revise, aprove ou rejeite as alterações enviadas pelos Auxiliares.
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1">
        {abas.map((aba) => {
          const count = contadores[aba.id]
          const isActive = abaAtiva === aba.id
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`
                flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors
                ${isActive
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"}
              `}
              aria-current={isActive ? "page" : undefined}
            >
              {aba.label}
              {count > 0 && (
                <span
                  className={`
                    flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold
                    ${aba.id === "pendente"
                      ? "bg-red-500 text-white"
                      : aba.id === "aprovado"
                      ? "bg-green-100 text-green-700"
                      : "bg-stone-200 text-stone-600"}
                  `}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-stone-400" />
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white py-20 text-center">
          <p className="text-stone-400">
            {abaAtiva === "pendente"
              ? "Nenhuma aprovação pendente."
              : abaAtiva === "aprovado"
              ? "Nenhuma aprovação aprovada ainda."
              : "Nenhuma aprovação rejeitada."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listaFiltrada.map((aprovacao) => (
            <CardAprovacao
              key={aprovacao.id}
              aprovacao={aprovacao}
              onAtualizar={handleAtualizar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
