import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/middleware"

const MASTER_ONLY_ROUTES = [
  "/admin/aprovacoes",
  "/admin/usuarios",
  "/admin/relatorios",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const response = NextResponse.next({ request })
  const supabase = createClient(request, response)

  // getUser() valida o JWT com o servidor — mais seguro que getSession() no middleware
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL("/admin/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Consulta o role na tabela admin_usuarios para o usuário autenticado.
  // RLS garante que cada usuário só enxerga o próprio registro.
  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  // Usuário autenticado mas sem registro ativo em admin_usuarios → é cliente, não admin
  if (!adminUser) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Auxiliar tentando acessar rota exclusiva de Master → redireciona para o dashboard
  if (
    adminUser.role === "auxiliar" &&
    MASTER_ONLY_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url))
  }

  // Master: acesso total. Auxiliar: acesso ao restante de /admin/*.
  return response
}

export const config = {
  matcher: ["/admin/:path*"],
}
