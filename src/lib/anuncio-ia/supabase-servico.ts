import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Server-only. Usado SOMENTE pelo processamento em segundo plano (que roda sem a
// sessão do usuário), sempre filtrando pelo id do anúncio.
// Nunca importar em componente client.
export function criarClienteServico(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    throw new Error("Cliente de serviço indisponível: variáveis de ambiente ausentes.")
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
