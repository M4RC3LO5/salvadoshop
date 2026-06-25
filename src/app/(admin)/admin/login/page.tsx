import Link from "next/link"
import { loginAction } from "./actions"

interface LoginPageProps {
  searchParams: { error?: string; redirect?: string }
}

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  const hasError = searchParams.error === "1"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-3xl font-bold tracking-tight text-stone-800">
          Salvado<span className="text-amber-700">Shop</span>
        </span>
        <p className="mt-1 text-xs font-medium uppercase tracking-widest text-red-600">
          Área administrativa — acesso restrito
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-amber-800/30 bg-white px-8 py-10 shadow-md">
        <h1 className="mb-6 text-center text-lg font-semibold text-stone-700">
          Entrar no painel
        </h1>

        {/* Erro de autenticação */}
        {hasError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.
          </div>
        )}

        <form action={loginAction} className="flex flex-col gap-5">
          {/* Campo e-mail */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-stone-600"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="seu@email.com"
              aria-describedby={hasError ? "login-error" : undefined}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          {/* Campo senha */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-stone-600"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              aria-describedby={hasError ? "login-error" : undefined}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
            />
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            className="mt-1 w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2 active:scale-[0.98]"
          >
            Entrar
          </button>
        </form>

        {/* Nota: sem opção de cadastro — admins são criados apenas pelo Master */}
      </div>

      {/* Link de volta ao site */}
      <Link
        href="/"
        className="mt-6 text-sm text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2 rounded"
      >
        ← Voltar ao site
      </Link>

    </div>
  )
}
