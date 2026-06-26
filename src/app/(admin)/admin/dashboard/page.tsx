import { createClient } from "@/lib/supabase/server"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

// ─── helpers ────────────────────────────────────────────────────────────────

function formatBRL(value: number | null) {
  if (value === null) return "—"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    publicado: "bg-green-100 text-green-800",
    pendente:  "bg-amber-100 text-amber-800",
    rejeitado: "bg-red-100   text-red-800",
    arquivado: "bg-stone-100 text-stone-600",
    aprovado:  "bg-green-100 text-green-800",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-stone-100 text-stone-600"}`}
    >
      {status}
    </span>
  )
}

function TipoLabel({ tipo }: { tipo: string }) {
  return tipo === "tipo_a" ? (
    <span className="text-xs text-stone-500">Individual</span>
  ) : (
    <span className="text-xs text-amber-700 font-medium">Lote</span>
  )
}

// ─── KPI card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  color?: "default" | "amber" | "red" | "green"
}

function KpiCard({ label, value, color = "default" }: KpiCardProps) {
  const border = {
    default: "border-stone-200",
    amber:   "border-amber-300",
    red:     "border-red-300",
    green:   "border-green-300",
  }[color]

  const text = {
    default: "text-stone-800",
    amber:   "text-amber-700",
    red:     "text-red-700",
    green:   "text-green-700",
  }[color]

  return (
    <div className={`rounded-xl border ${border} bg-white p-5 shadow-sm`}>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${text}`}>{value}</p>
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  // Verifica role do usuário logado (necessário para seção Master-only)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .eq("ativo", true)
    .single()

  const isMaster = adminUser?.role === "master"

  // KPIs — contagens paralelas
  const [
    { count: total },
    { count: publicados },
    { count: pendentes },
    { count: rejeitados },
  ] = await Promise.all([
    supabase.from("produtos").select("*", { count: "exact", head: true }),
    supabase.from("produtos").select("*", { count: "exact", head: true }).eq("status", "publicado"),
    supabase.from("produtos").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("produtos").select("*", { count: "exact", head: true }).eq("status", "rejeitado"),
  ])

  // Produtos recentes
  const { data: produtosRecentes } = await supabase
    .from("produtos")
    .select("id, nome, tipo, preco_ml, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  // Últimas atividades (somente para Master)
  const { data: atividades } = isMaster
    ? await supabase
        .from("aprovacoes")
        .select("id, tipo_alteracao, status, created_at, produto_id")
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: null }

  return (
    <div className="flex flex-col gap-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">
          Visão geral do painel administrativo.
        </p>
      </div>

      {/* KPIs — 2 colunas mobile, 4 desktop */}
      <section aria-label="Indicadores">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total de Produtos" value={total ?? 0} />
          <KpiCard label="Publicados"         value={publicados ?? 0} color="green" />
          <KpiCard label="Pendentes"          value={pendentes  ?? 0} color="amber" />
          <KpiCard label="Rejeitados"         value={rejeitados ?? 0} color="red"   />
        </div>
      </section>

      {/* Produtos recentes */}
      <section aria-label="Produtos recentes">
        <h2 className="mb-4 text-base font-semibold text-stone-700">
          Produtos recentes
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Preço ML</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {produtosRecentes && produtosRecentes.length > 0 ? (
                  produtosRecentes.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-stone-800">
                        {p.nome}
                      </td>
                      <td className="px-4 py-3">
                        <TipoLabel tipo={p.tipo} />
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {formatBRL(p.preco_ml)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(p.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Nenhum produto cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Últimas atividades — somente Master */}
      {isMaster && (
        <section aria-label="Últimas atividades">
          <h2 className="mb-4 text-base font-semibold text-stone-700">
            Últimas atividades na fila de aprovações
          </h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            {atividades && atividades.length > 0 ? (
              <ul className="divide-y divide-stone-100">
                {atividades.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium capitalize text-stone-700">
                        {a.tipo_alteracao.replace("_", " ")}
                      </span>
                      <span className="text-xs text-stone-400">
                        {formatDistanceToNow(new Date(a.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-stone-400">
                Nenhuma atividade registrada ainda.
              </p>
            )}
          </div>
        </section>
      )}

    </div>
  )
}
