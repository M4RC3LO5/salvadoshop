import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um item."),
  lista_destino_id: z.string().uuid("Lista de destino inválida."),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Body inválido." } },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }

  const { ids, lista_destino_id: listaDestinoId } = parsed.data

  // Lista de destino precisa existir
  const { data: listaDestino, error: listaError } = await supabase
    .from("triagem_listas")
    .select("id")
    .eq("id", listaDestinoId)
    .single()

  if (listaError || !listaDestino) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Lista de destino não encontrada." } },
      { status: 422 }
    )
  }

  // Todos os ids precisam existir
  const { data: itensExistentes, error: itensError } = await supabase
    .from("estoque_itens")
    .select("id")
    .in("id", ids)

  if (itensError) {
    console.error(JSON.stringify({ event: "triagem.itens.mover.select.error", error: itensError }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao validar os itens selecionados." } },
      { status: 500 }
    )
  }

  const idsExistentes = new Set((itensExistentes ?? []).map((i) => i.id))
  const idsInvalidos = ids.filter((id) => !idsExistentes.has(id))
  if (idsInvalidos.length > 0) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Um ou mais itens selecionados não foram encontrados." } },
      { status: 422 }
    )
  }

  // Maior ordem já usada na lista destino — os itens movidos entram no fim
  const { data: ultimoItem, error: ordemError } = await supabase
    .from("estoque_itens")
    .select("ordem")
    .eq("lista_id", listaDestinoId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ordemError) {
    console.error(JSON.stringify({ event: "triagem.itens.mover.ordem.error", error: ordemError }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao calcular a ordem na lista de destino." } },
      { status: 500 }
    )
  }

  let proximaOrdem = (ultimoItem?.ordem ?? 0) + 1

  const resultados = await Promise.all(
    ids.map((id) =>
      supabase
        .from("estoque_itens")
        .update({ lista_id: listaDestinoId, ordem: proximaOrdem++, updated_at: new Date().toISOString() })
        .eq("id", id)
    )
  )

  const falhou = resultados.find((r) => r.error)
  if (falhou) {
    console.error(JSON.stringify({ event: "triagem.itens.mover.update.error", error: falhou.error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao mover os itens." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: { movidos: ids.length } })
}
