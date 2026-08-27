import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const ESTADOS = ["lacrado", "avaria_leve", "avaria_grave", "sucata"] as const
const ORIGENS = ["sinistro", "fabricante", "ecommerce", "atacado", "avulso"] as const

// Campos editáveis via inline-edit — total_unidades é gerada pelo banco,
// e foto_url/tipo_captura/lista_id/ordem/criado_por não são editáveis por aqui.
const patchSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório.").optional(),
  marca: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  qtd_embalagem: z.number().int().positive().optional(),
  num_caixas: z.number().int().positive().optional(),
  lote: z.string().nullable().optional(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de validade inválida.").nullable().optional(),
  estado: z.enum(ESTADOS).nullable().optional(),
  estado_livre: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  custo_unitario: z.number().nonnegative().nullable().optional(),
  origem: z.enum(ORIGENS).nullable().optional(),
  fornecedor: z.string().nullable().optional(),
}).strict()

// ── PATCH — edição inline de um campo ────────────────────────────────────────

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

  const parsed = patchSchema.safeParse(body)
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

  if (Object.keys(parsed.data).length !== 1) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Envie exatamente um campo por vez." } },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from("estoque_itens")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, total_unidades")
    .single()

  if (error || !data) {
    console.error(JSON.stringify({ event: "triagem.itens.patch.error", error, item_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao salvar a alteração." } },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data })
}

// ── DELETE — exclusão individual ─────────────────────────────────────────────

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

  const { data: item } = await supabase
    .from("estoque_itens")
    .select("foto_url")
    .eq("id", params.id)
    .single()

  const { error } = await supabase
    .from("estoque_itens")
    .delete()
    .eq("id", params.id)

  if (error) {
    console.error(JSON.stringify({ event: "triagem.itens.delete.error", error, item_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao excluir o item." } },
      { status: 500 }
    )
  }

  // A foto deixou de ser armazenada para itens novos (foto_url é sempre null).
  // Guarda mantida só para limpar o Storage de itens antigos que ainda têm foto_url preenchido.
  if (item?.foto_url) {
    try {
      await supabase.storage.from("triagem").remove([item.foto_url])
    } catch {
      // best-effort — falha ao remover a foto não deve impedir a resposta de sucesso
    }
  }

  return Response.json({ success: true })
}
