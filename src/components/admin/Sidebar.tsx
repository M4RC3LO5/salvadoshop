"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  CheckSquare,
  Users,
  BarChart,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface SidebarProps {
  role: "master" | "auxiliar"
  pendingCount?: number
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  masterOnly?: boolean
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",     href: "/admin/dashboard",  icon: LayoutDashboard },
  { label: "Produtos",      href: "/admin/produtos",   icon: Package },
  { label: "Novo Produto",  href: "/admin/produtos/novo", icon: PlusCircle },
  { label: "Aprovações",    href: "/admin/aprovacoes", icon: CheckSquare, masterOnly: true },
  { label: "Usuários",      href: "/admin/usuarios",   icon: Users,       masterOnly: true },
  { label: "Relatórios",    href: "/admin/relatorios", icon: BarChart,    masterOnly: true },
]

export function Sidebar({ role, pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.masterOnly || role === "master"
  )

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 bg-stone-900 px-5 py-4">
        <span className="text-lg font-bold text-white">
          SalvadoShop{" "}
          <span className="font-normal text-amber-400">Admin</span>
        </span>
      </div>

      {/* Role badge */}
      <div className="border-b border-stone-700 bg-stone-800 px-5 py-2">
        <span className="text-xs font-medium uppercase tracking-widest text-stone-400">
          {role === "master" ? "Master" : "Auxiliar"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto bg-stone-800 px-3 py-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
          const showBadge = item.masterOnly && item.href === "/admin/aprovacoes" && pendingCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`
                flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${isActive
                  ? "bg-amber-700 text-white"
                  : "text-stone-300 hover:bg-stone-700 hover:text-white"}
              `}
            >
              <span className="flex items-center gap-3">
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </span>
              {showBadge && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
                  aria-label={`${pendingCount} aprovações pendentes`}
                >
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé — Sair */}
      <div className="border-t border-stone-700 bg-stone-800 px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-300 transition-colors hover:bg-red-900/50 hover:text-red-300"
          aria-label="Sair do painel administrativo"
        >
          <LogOut size={18} aria-hidden="true" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Botão hamburguer — mobile */}
      <button
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800 text-white shadow-md lg:hidden"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar mobile — drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Menu de navegação do painel"
      >
        <SidebarContent />
      </aside>

      {/* Sidebar desktop — estática */}
      <aside
        className="hidden w-64 shrink-0 lg:flex lg:flex-col"
        aria-label="Menu de navegação do painel"
      >
        <SidebarContent />
      </aside>
    </>
  )
}
