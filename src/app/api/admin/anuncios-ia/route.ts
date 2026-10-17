import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"

const URL_PREFIXO = "https://res.cloudinary.com/dtuclb3q1/image/upload/"
const PUBLIC_ID_REGEX = /^salvadoshop\/anuncios-ia\/temp\/[A-Za-z0-9_-]+$/

const imagemSchema = z.object({
  url: z.string().startsWith(URL_PREFIXO),
  public_id: z.string().regex(PUBLIC_ID_REGEX),
  tipo: z.enum(["foto", "print_pedido"]),
})

const bodySchema = z
  .object({ imagens: z.array(imagemSchema).max(10) })
  .superRefine(({ imagens }, ctx) => {
    const fotos = imagens.filter((i) => i.tipo === "foto").length
    const prints = imagens.length - fotos
    if (fotos < 1) {
      ctx.addIssue({ code: "custom", message: "Envie pelo menos 1 foto do produto." })
    }
    if (fotos > 8) {
      ctx.addIssue({ code: "custom", message: "Máximo de 8 fotos do produto." })
    }
    if (prints > 2) {
      ctx.addIssue({ code: "custom", message: "Máximo de 2 prints do pedido." })
    }
    if (new Set(imagens.map((i) => i.public_id)).size !== imagens.length) {
      ctx.addIssue({ code: "custom", message: "Há imagens repetidas." })
    }
  })

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Requisição inválida.", 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return erroValidacao(
      parsed.error.issues[0]?.message ?? "Dados inválidos. Confira as imagens enviadas."
    )
  }

  // Client da sessão (RLS valendo). status e criado_por ficam no default do banco.
  const { data, error } = await guard.supabase
    .from("anuncios_ia")
    .insert({ imagens: parsed.data.imagens })
    .select("id")
    .single()

  if (error || !data) {
    return erroInterno("anuncios_ia.criar.error", error, "Não foi possível enviar o anúncio. Tente novamente.")
  }

  console.log(JSON.stringify({
    event: "anuncio_ia.enviado",
    anuncio_id: data.id,
    admin_id: guard.adminUser.id,
    role: guard.adminUser.role,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: data.id } })
}
