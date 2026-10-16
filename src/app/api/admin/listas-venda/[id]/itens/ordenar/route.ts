import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"

const idSchema = z.string().uuid()

const bodySchema = z.array(
  z.object({ id: z.string().uuid(), ordem: z.number().int().min(1) })
).min(1, "Envie ao menos um item.").max(1000)

// POST — grava a nova ordem dos itens da lista
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  if (!idSchema.safeParse(params.id).success) return erroValidacao("ID inválido.", 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Body inválido.", 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos.")

  const resultados = await Promise.all(
    parsed.data.map((item) =>
      guard.supabase
        .from("listas_venda_itens")
        .update({ ordem: item.ordem })
        .eq("id", item.id)
        .eq("lista_venda_id", params.id)
    )
  )

  const falhou = resultados.find((r) => r.error)
  if (falhou) return erroInterno("listas_venda.itens.ordenar.error", falhou.error, "Erro ao salvar a nova ordem.")
  return Response.json({ success: true })
}
