import { NextRequest } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { requireAdmin, erroValidacao } from "@/lib/supabase/admin-guard"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — o cliente já envia a imagem reduzida

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return erroValidacao("Formato de requisição inválido.", 400)
  }

  const file = formData.get("arquivo")
  if (!(file instanceof File)) {
    return erroValidacao("Nenhum arquivo enviado.", 400)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return erroValidacao("Formato inválido. Use JPG, PNG ou WEBP.")
  }

  if (file.size > MAX_BYTES) {
    return erroValidacao("Arquivo muito grande. Máximo 4MB.")
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const resultado = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "salvadoshop/anuncios-ia/temp",
            transformation: [{ width: 1600, height: 1600, crop: "limit", quality: 85 }],
            resource_type: "image",
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error("Upload falhou."))
            resolve({ secure_url: result.secure_url, public_id: result.public_id })
          }
        )
        stream.end(buffer)
      }
    )

    return Response.json({
      success: true,
      data: { url: resultado.secure_url, public_id: resultado.public_id },
    })
  } catch (error) {
    console.error(JSON.stringify({ event: "anuncios_ia.upload.error", error }))
    return Response.json(
      { success: false, error: { code: "UPLOAD_FAILED", message: "Falha no upload. Tente novamente." } },
      { status: 500 }
    )
  }
}
