"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// TODO: implementar rate limiting com @upstash/ratelimit + Vercel KV
// quando disponível. Regra: máximo 5 tentativas por IP por 15 minutos.
// Exemplo:
//   const ratelimit = new Ratelimit({ redis: kv, limiter: Ratelimit.slidingWindow(5, "15 m") })
//   const { success } = await ratelimit.limit(ip)
//   if (!success) redirect("/admin/login?error=rate_limit")

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    redirect("/admin/login?error=1")
  }

  const supabase = createClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    redirect("/admin/login?error=1")
  }

  // Verifica se o usuário existe em admin_usuarios e está ativo.
  // Bloqueia clientes que por acaso tenham conta no Supabase Auth.
  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id, role, ativo")
    .eq("user_id", authData.user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    // Encerra a sessão para não deixar o cliente autenticado na área admin
    await supabase.auth.signOut()
    redirect("/admin/login?error=1")
  }

  redirect("/admin/dashboard")
}
