import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.array(
  z.object({
    id: z.string().uuid(),
    ordem: z.number().int(),
  })
).min(1, "Envie ao menos um item.")

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

  const resultados = await Promise.all(
    parsed.data.map((item) =>
      supabase.from("estoque_itens").update({ ordem: item.ordem }).eq("id", item.id)
    )
  )

  const falhou = resultados.find((r) => r.error)
  if (falhou) {
    console.error(JSON.stringify({ event: "triagem.itens.ordenar.error", error: falhou.error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao salvar a nova ordem." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
