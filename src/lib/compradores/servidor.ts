import type { SupabaseClient } from "@supabase/supabase-js"
import { soDigitos } from "./rotulos"

// Segmentos pedidos precisam existir e estar ativos. Devolve a lista sem repetidos.
export async function validarSegmentos(
  supabase: SupabaseClient,
  ids: number[]
): Promise<{ ok: true; ids: number[] } | { ok: false; erro: boolean }> {
  const unicos = Array.from(new Set(ids))
  if (unicos.length === 0) return { ok: true, ids: [] }
  const { data, error } = await supabase.from("segmentos").select("id").in("id", unicos).eq("ativo", true)
  if (error) return { ok: false, erro: true }
  if ((data ?? []).length !== unicos.length) return { ok: false, erro: false }
  return { ok: true, ids: unicos }
}

// Procura OUTRO comprador com o mesmo telefone ou celular (compara só os dígitos,
// cruzando telefone e celular nas duas colunas).
export async function buscarDuplicado(
  supabase: SupabaseClient,
  telefone: string | null,
  celular: string | null,
  ignorarId?: string
): Promise<{ erro: boolean; duplicado: { id: string; empresa: string } | null }> {
  const digitos = Array.from(new Set([soDigitos(telefone), soDigitos(celular)].filter((d) => d.length > 0)))
  if (digitos.length === 0) return { erro: false, duplicado: null }

  const lista = digitos.join(",")
  let consulta = supabase
    .from("compradores")
    .select("id, empresa")
    .or(`telefone_digitos.in.(${lista}),celular_digitos.in.(${lista})`)
    .limit(1)
  if (ignorarId) consulta = consulta.neq("id", ignorarId)

  const { data, error } = await consulta
  if (error) return { erro: true, duplicado: null }
  const achado = data?.[0] as { id: string; empresa: string } | undefined
  return { erro: false, duplicado: achado ?? null }
}

export function respostaDuplicado(d: { id: string; empresa: string }) {
  return Response.json(
    {
      success: false,
      error: { code: "DUPLICADO", message: `Já existe ${d.empresa} com esse telefone.` },
      data: { id: d.id, empresa: d.empresa },
    },
    { status: 409 }
  )
}
