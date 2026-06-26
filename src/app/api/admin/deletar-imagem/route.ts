import { NextRequest } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

const bodySchema = z.object({
  public_id: z.string().min(1),
})

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  const { data: adminUser } = await supabase
    .from("admin_usuarios").select("role")
    .eq("user_id", user.id).eq("ativo", true).single()
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
      { success: false, error: { code: "VALIDATION_ERROR", message: "public_id é obrigatório." } },
      { status: 422 }
    )
  }

  // Garante que o public_id pertence ao SalvadoShop (evita deleção de recursos externos)
  if (!parsed.data.public_id.startsWith("salvadoshop/")) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Recurso não autorizado." } },
      { status: 403 }
    )
  }

  try {
    await cloudinary.uploader.destroy(parsed.data.public_id)
    return Response.json({ success: true })
  } catch {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Falha ao deletar imagem." } },
      { status: 500 }
    )
  }
}
