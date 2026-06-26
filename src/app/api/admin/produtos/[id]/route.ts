import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({ secure: true })

// ── PATCH — atualizar status ──────────────────────────────────────────────────

const patchSchema = z.object({
  status: z.enum(["rascunho", "pendente", "publicado", "rejeitado"]),
})

export async function PATCH(
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
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem alterar o status." } },
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }

  const { error } = await supabase
    .from("produtos")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    console.error(JSON.stringify({ event: "produto.patch.error", error, produto_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar produto." } },
      { status: 500 }
    )
  }

  console.log(JSON.stringify({
    event: "produto.status_alterado",
    produto_id: params.id,
    novo_status: parsed.data.status,
    admin_id: adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true })
}

// ── DELETE — excluir produto e imagens do Cloudinary ─────────────────────────

export async function DELETE(
  _request: NextRequest,
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
    .select("id, role")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser || adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem excluir produtos." } },
      { status: 403 }
    )
  }

  // Busca public_ids das imagens para deletar do Cloudinary
  const { data: imagens } = await supabase
    .from("produto_imagens")
    .select("public_id")
    .eq("produto_id", params.id)

  // Exclui produto (ON DELETE CASCADE remove imagens da tabela)
  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", params.id)

  if (error) {
    console.error(JSON.stringify({ event: "produto.delete.error", error, produto_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao excluir produto." } },
      { status: 500 }
    )
  }

  // Remove imagens do Cloudinary (best-effort — falha silenciosa)
  if (imagens && imagens.length > 0) {
    const publicIds = imagens.map((i) => i.public_id).filter(Boolean)
    if (publicIds.length > 0) {
      try {
        await cloudinary.api.delete_resources(publicIds)
      } catch (err) {
        console.error(JSON.stringify({ event: "cloudinary.delete.error", error: err, produto_id: params.id }))
      }
    }
  }

  console.log(JSON.stringify({
    event: "produto.excluido",
    produto_id: params.id,
    admin_id: adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true })
}
