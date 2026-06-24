import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/middleware"

// Rotas do painel admin restritas ao perfil Master
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- usado quando roles forem implementados
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

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL("/conta/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // TODO: verificar role do usuário na tabela admin_usuarios quando o banco estiver configurado.
  // Regras a implementar:
  //   - Cliente (sem registro em admin_usuarios) → redireciona para /
  //   - Auxiliar + rota em MASTER_ONLY_ROUTES   → redireciona para /admin
  //   - Master                                  → acesso total em /admin/*

  return response
}

export const config = {
  matcher: ["/admin/:path*"],
}
