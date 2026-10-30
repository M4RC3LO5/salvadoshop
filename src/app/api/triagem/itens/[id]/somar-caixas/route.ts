import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const somarSchema = z.object({
  quantidade: z.number().int().min(1).max(999),
  caixas_atuais: z.number().int().min(1),
  lista_id: z.string().uuid(),
})

// ── POST — soma caixas numa linha já triada ─────────────────────────────────
// Update condicional em num_caixas: se outra pessoa alterou a linha no meio
// tempo, nenhuma linha é afetada e o cliente recebe 409.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    .select("id, nome")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  if (!z.string().uuid().safeParse(params.id).success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Item inválido." } },
      { status: 422 }
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

  const parsed = somarSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    )
  }

  const { quantidade, caixas_atuais, lista_id } = parsed.data

  const { data, error } = await supabase
    .from("estoque_itens")
    .update({ num_caixas: caixas_atuais + quantidade, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("lista_id", lista_id)
    .eq("num_caixas", caixas_atuais)
    .select("id, num_caixas, total_unidades")

  if (error) {
    console.error(JSON.stringify({ event: "triagem.itens.somar_caixas.error", error, item_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao somar as caixas." } },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Este item acabou de ser alterado por outra pessoa. Confira e tente de novo.",
        },
      },
      { status: 409 }
    )
  }

  console.log(JSON.stringify({
    event: "triagem.itens.caixas_somadas",
    item_id: params.id,
    lista_id,
    quantidade,
    admin_id: adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: data[0] })
}
