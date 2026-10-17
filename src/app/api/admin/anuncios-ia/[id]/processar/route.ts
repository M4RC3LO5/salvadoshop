import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"
import { NaoProcessavelError, processarAnuncio } from "@/lib/anuncio-ia/processar"

export const maxDuration = 60

const idSchema = z.uuid()

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const id = idSchema.safeParse(params.id)
  if (!id.success) return erroValidacao("Anúncio inválido.")

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Serviço indisponível." } },
      { status: 503 }
    )
  }

  try {
    // Client da SESSÃO (RLS valendo) — sem service role.
    const { status } = await processarAnuncio(guard.supabase, id.data)
    return Response.json({ success: true, data: { status } })
  } catch (error) {
    if (error instanceof NaoProcessavelError) {
      return erroValidacao("Este anúncio já está sendo processado ou já foi concluído.", 409)
    }
    return erroInterno("anuncio_ia.processar.route.error", error, "Não foi possível processar. Tente novamente.")
  }
}
