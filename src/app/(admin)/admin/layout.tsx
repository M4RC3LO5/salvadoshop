import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/admin/Sidebar"

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Página de login não deve ter sidebar — detecta via header injetado pelo middleware
  const pathname = headers().get("x-pathname") ?? ""
  if (pathname.startsWith("/admin/login")) {
    return <>{children}</>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  // Sem registro admin → middleware já redirecionaria, mas protege por dupla camada
  if (!adminUser) {
    redirect("/")
  }

  // Busca contagem de aprovações pendentes (somente para Master)
  let pendingCount = 0
  if (adminUser.role === "master") {
    const { count } = await supabase
      .from("aprovacoes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente")
    pendingCount = count ?? 0
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={adminUser.role as "master" | "auxiliar"} pendingCount={pendingCount} />

      {/* Área de conteúdo */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barra de topo — espaço para o hamburguer no mobile */}
        <header className="flex h-14 items-center border-b border-stone-200 bg-white px-4 lg:hidden">
          {/* espaço reservado para o botão hamburguer fixo */}
          <div className="w-9" aria-hidden="true" />
          <span className="ml-3 text-sm font-semibold text-stone-700">
            SalvadoShop Admin
          </span>
        </header>

        <main className="flex-1 overflow-auto bg-stone-100 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
