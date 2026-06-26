import Link from "next/link"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { NovoProdutoForm } from "./NovoProdutoForm"

export default async function NovoProdutoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role, nome")
    .eq("user_id", user?.id ?? "")
    .eq("ativo", true)
    .single()

  const isAuxiliar = adminUser?.role === "auxiliar"

  return (
    <div className="mx-auto max-w-5xl">

      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-1 flex items-center gap-2 text-xs text-stone-400">
        <Link href="/admin/produtos" className="hover:text-stone-600 transition-colors">
          Produtos
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-stone-600 font-medium">Novo</span>
      </nav>

      {/* Título */}
      <h1 className="mb-6 text-2xl font-bold text-stone-800">Novo Produto</h1>

      {/* Banner de aviso — Auxiliar */}
      {isAuxiliar && (
        <div
          role="note"
          aria-label="Aviso sobre fluxo de aprovação"
          className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Produto entrará para aprovação
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Como <strong>Auxiliar</strong>, seus produtos ficam com status{" "}
              <strong>Pendente</strong> até serem aprovados pelo Master.
              Você receberá uma notificação após a revisão.
            </p>
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <NovoProdutoForm role={adminUser?.role === "master" ? "master" : "auxiliar"} />
      </div>

    </div>
  )
}
