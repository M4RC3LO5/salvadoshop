"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  Plus,
  Loader2,
  ShieldCheck,
  User,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AdminUsuario {
  id: string
  user_id: string
  nome: string
  email: string
  role: "master" | "auxiliar"
  ativo: boolean
  created_at: string
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function inicial(nome: string) {
  return nome.trim().charAt(0).toUpperCase()
}

function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso)
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "master" | "auxiliar" }) {
  return role === "master" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      <ShieldCheck size={11} aria-hidden="true" />
      Master
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
      <User size={11} aria-hidden="true" />
      Auxiliar
    </span>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
      <CheckCircle2 size={11} aria-hidden="true" />
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
      <XCircle size={11} aria-hidden="true" />
      Inativo
    </span>
  )
}

// ── Modal Novo Usuário ─────────────────────────────────────────────────────────

interface ModalNovoUsuarioProps {
  onClose: () => void
  onCriado: () => void
}

function ModalNovoUsuario({ onClose, onCriado }: ModalNovoUsuarioProps) {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"master" | "auxiliar">("auxiliar")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")
  const [senhaTmp, setSenhaTmp] = useState("")
  const [copiado, setCopiado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setLoading(true)

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, role }),
      })
      const json = await res.json()
      if (!json.success) {
        setErro(json.error?.message ?? "Erro ao criar usuário.")
      } else {
        setSenhaTmp(json.data.senhaTmp)
      }
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  async function copiarSenha() {
    await navigator.clipboard.writeText(senhaTmp)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function fecharAposCriacao() {
    onCriado()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 id="modal-titulo" className="text-lg font-semibold text-stone-800">
            {senhaTmp ? "Usuário criado com sucesso!" : "Novo Usuário Admin"}
          </h2>
        </div>

        {senhaTmp ? (
          /* ── Tela pós-criação: exibe senha temporária ── */
          <div className="px-6 py-6">
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} aria-hidden="true" />
                <p className="text-sm text-amber-800">
                  Anote a senha temporária abaixo e passe para o novo usuário. Ela <strong>não será exibida novamente</strong>.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-xs font-medium text-stone-500 uppercase tracking-wide">Senha temporária</p>
              <div className="flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-4 py-3">
                <code className="flex-1 font-mono text-sm font-semibold text-stone-800">{senhaTmp}</code>
                <button
                  onClick={copiarSenha}
                  className="flex items-center gap-1 rounded-md bg-stone-200 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-300 transition-colors"
                  aria-label="Copiar senha"
                >
                  {copiado ? <Check size={13} /> : <Copy size={13} />}
                  {copiado ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <button
              onClick={fecharAposCriacao}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 transition-colors"
            >
              Entendido, fechar
            </button>
          </div>
        ) : (
          /* ── Formulário ── */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {erro && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
                {erro}
              </div>
            )}

            <div>
              <label htmlFor="nome" className="mb-1 block text-sm font-medium text-stone-700">
                Nome completo
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                minLength={2}
                placeholder="Ex: João Silva"
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="joao@exemplo.com"
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-medium text-stone-700">
                Perfil de acesso
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "master" | "auxiliar")}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                <option value="auxiliar">Auxiliar — cadastra e edita produtos</option>
                <option value="master">Master — acesso total ao painel</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60 transition-colors"
              >
                {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {loading ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Modal Confirmação Exclusão ─────────────────────────────────────────────────

interface ModalConfirmarExclusaoProps {
  usuario: AdminUsuario
  onClose: () => void
  onExcluido: () => void
}

function ModalConfirmarExclusao({ usuario, onClose, onExcluido }: ModalConfirmarExclusaoProps) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  async function handleExcluir() {
    setErro("")
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) {
        setErro(json.error?.message ?? "Erro ao excluir.")
      } else {
        onExcluido()
        onClose()
      }
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-excluir-titulo"
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 id="modal-excluir-titulo" className="text-lg font-semibold text-red-700">
            Excluir usuário
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="mb-2 text-sm text-stone-700">
            Você está prestes a excluir permanentemente o usuário:
          </p>
          <p className="mb-4 font-semibold text-stone-900">{usuario.nome}</p>
          <p className="text-xs text-stone-500 mb-4">
            Esta ação remove o acesso ao painel e não pode ser desfeita.
          </p>

          {erro && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
              {erro}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExcluir}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [modalNovo, setModalNovo] = useState(false)
  const [modalExcluir, setModalExcluir] = useState<AdminUsuario | null>(null)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  const carregarUsuarios = useCallback(async () => {
    setErro("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/usuarios")
      const json = await res.json()
      if (res.status === 403) {
        router.replace("/admin/dashboard")
        return
      }
      if (!json.success) {
        setErro(json.error?.message ?? "Erro ao carregar usuários.")
      } else {
        setUsuarios(json.data)
      }
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }, [router])

  // Carrega o user_id do usuário atual para desabilitar ações sobre si mesmo
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
    carregarUsuarios()
  }, [carregarUsuarios])

  async function toggleAtivo(usuario: AdminUsuario) {
    setAtualizando(usuario.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !usuario.ativo }),
      })
      const json = await res.json()
      if (json.success) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuario.id ? { ...u, ativo: !u.ativo } : u))
        )
      }
    } finally {
      setAtualizando(null)
    }
  }

  async function alterarRole(usuario: AdminUsuario, novoRole: "master" | "auxiliar") {
    setAtualizando(usuario.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: novoRole }),
      })
      const json = await res.json()
      if (json.success) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuario.id ? { ...u, role: novoRole } : u))
        )
      }
    } finally {
      setAtualizando(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-stone-400" size={24} aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-stone-800">Usuários Admin</h1>
            <p className="text-sm text-stone-500">Gerencie os usuários do painel administrativo</p>
          </div>
        </div>
        <button
          onClick={() => setModalNovo(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Novo Usuário
        </button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-amber-700" size={32} aria-label="Carregando usuários" />
        </div>
      ) : erro ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-6 py-5 text-center">
          <p className="text-sm text-red-700">{erro}</p>
          <button
            onClick={carregarUsuarios}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Cadastro
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usuarios.map((u) => {
                const ehEuMesmo = u.user_id === currentUserId
                const carregando = atualizando === u.id

                return (
                  <tr key={u.id} className={`transition-colors ${!u.ativo ? "opacity-60" : "hover:bg-stone-50"}`}>
                    {/* Avatar + Nome + Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800"
                          aria-hidden="true"
                        >
                          {inicial(u.nome)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-800">
                            {u.nome}
                            {ehEuMesmo && (
                              <span className="ml-2 text-xs font-normal text-stone-400">(você)</span>
                            )}
                          </p>
                          <p className="text-xs text-stone-500">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">
                      {ehEuMesmo ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => alterarRole(u, e.target.value as "master" | "auxiliar")}
                          disabled={carregando}
                          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200 disabled:opacity-50"
                          aria-label={`Alterar perfil de ${u.nome}`}
                        >
                          <option value="auxiliar">Auxiliar</option>
                          <option value="master">Master</option>
                        </select>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <StatusBadge ativo={u.ativo} />
                    </td>

                    {/* Data */}
                    <td className="px-4 py-4 text-xs text-stone-500">
                      {formatarData(u.created_at)}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!ehEuMesmo && (
                          <>
                            {/* Toggle ativo/inativo */}
                            <button
                              onClick={() => toggleAtivo(u)}
                              disabled={carregando}
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                u.ativo
                                  ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                              aria-label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
                            >
                              {carregando ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : u.ativo ? (
                                <XCircle size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              {u.ativo ? "Desativar" : "Ativar"}
                            </button>

                            {/* Excluir — apenas se inativo */}
                            {!u.ativo && (
                              <button
                                onClick={() => setModalExcluir(u)}
                                disabled={carregando}
                                className="flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                                aria-label={`Excluir ${u.nome}`}
                              >
                                <Trash2 size={13} />
                                Excluir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-stone-400">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {modalNovo && (
        <ModalNovoUsuario
          onClose={() => setModalNovo(false)}
          onCriado={carregarUsuarios}
        />
      )}

      {modalExcluir && (
        <ModalConfirmarExclusao
          usuario={modalExcluir}
          onClose={() => setModalExcluir(null)}
          onExcluido={carregarUsuarios}
        />
      )}
    </div>
  )
}
