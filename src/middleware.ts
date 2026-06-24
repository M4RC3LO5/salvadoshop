import { NextRequest, NextResponse } from "next/server"

// Rotas do painel admin restritas ao perfil Master
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- usado quando roles forem implementados
const MASTER_ONLY_ROUTES = [
  "/admin/aprovacoes",
  "/admin/usuarios",
  "/admin/relatorios",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  // TODO: substituir pela verificação real de sessão via Supabase Auth quando
  // o cliente Supabase estiver configurado em src/lib/supabase/.
  // Exemplo:
  //   const supabase = createMiddlewareClient({ req: request, res: response })
  //   const { data: { session } } = await supabase.auth.getSession()
  //
  // Após obter a sessão, buscar o perfil em admin_usuarios para verificar o role:
  //   const role = session?.user?.user_metadata?.role  // 'master' | 'auxiliar'
  //
  // Regras:
  //   - Não autenticado  → redireciona para /conta/login
  //   - Cliente (sem role admin) → redireciona para /
  //   - Auxiliar + rota MASTER_ONLY_ROUTES → redireciona para /admin
  //   - Master → acesso total em /admin/*

  const session = null // placeholder até Supabase estar conectado

  if (!session) {
    const loginUrl = new URL("/conta/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
