import { NextRequest } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { createClient } from "@/lib/supabase/server"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  // Autenticação
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

  // Lê o arquivo do multipart
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Formato de requisição inválido." } },
      { status: 400 }
    )
  }

  const file = formData.get("arquivo")
  if (!(file instanceof File)) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Nenhum arquivo enviado." } },
      { status: 400 }
    )
  }

  // Valida formato
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Formato inválido. Use JPG, PNG ou WEBP." } },
      { status: 422 }
    )
  }

  // Valida tamanho
  if (file.size > MAX_BYTES) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Arquivo muito grande. Máximo 10MB." } },
      { status: 422 }
    )
  }

  // Converte para Buffer e faz upload via stream
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  try {
    const resultado = await new Promise<{
      secure_url: string
      public_id: string
      width: number
      height: number
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "salvadoshop/produtos/temp",
          transformation: [{ width: 800, height: 800, crop: "limit", quality: 85 }],
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload falhou."))
          resolve({
            secure_url: result.secure_url,
            public_id:  result.public_id,
            width:      result.width,
            height:     result.height,
          })
        }
      )
      stream.end(buffer)
    })

    return Response.json({
      success: true,
      data: {
        url:       resultado.secure_url,
        public_id: resultado.public_id,
        width:     resultado.width,
        height:    resultado.height,
      },
    })
  } catch {
    return Response.json(
      { success: false, error: { code: "UPLOAD_FAILED", message: "Falha no upload. Tente novamente." } },
      { status: 500 }
    )
  }
}
