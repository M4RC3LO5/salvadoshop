import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const aprovarSchema = z.object({
  acao: z.literal("aprovar"),
})

const rejeitarSchema = z.object({
  acao: z.literal("rejeitar"),
  motivo: z.string().min(10, "O motivo deve ter pelo menos 10 caracteres."),
})

const patchSchema = z.discriminatedUnion("acao", [aprovarSchema, rejeitarSchema])

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
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem aprovar ou rejeitar." } },
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
          details: parsed.error.issues,
        },
      },
      { status: 422 }
    )
  }

  // Busca a aprovação com dados_novos
  const { data: aprovacao } = await supabase
    .from("aprovacoes")
    .select("id, produto_id, dados_novos, status")
    .eq("id", params.id)
    .single()

  if (!aprovacao) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Aprovação não encontrada." } },
      { status: 404 }
    )
  }

  if (aprovacao.status !== "pendente") {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Esta aprovação já foi processada." } },
      { status: 422 }
    )
  }

  const now = new Date().toISOString()

  if (parsed.data.acao === "aprovar") {
    const novos = aprovacao.dados_novos as Record<string, unknown>

    // Monta payload para atualizar o produto com dados_novos
    const produtoPayload: Record<string, unknown> = {
      nome: novos.nome,
      descricao: novos.descricao,
      specs_tecnicas: novos.specs_tecnicas,
      tipo: novos.tipo,
      categoria: novos.categoria,
      status: "publicado",
      aprovado_por: adminUser.id,
      updated_at: now,
    }

    if (novos.tipo === "tipo_a") {
      produtoPayload.preco_ml = novos.preco_ml
      produtoPayload.url_ml = novos.url_ml
      produtoPayload.estoque = novos.estoque
      produtoPayload.quantidade_lote = null
    } else {
      produtoPayload.quantidade_lote = novos.quantidade_lote
      produtoPayload.preco_ml = null
      produtoPayload.url_ml = null
      produtoPayload.estoque = 0
    }

    const { error: erroUpdate } = await supabase
      .from("produtos")
      .update(produtoPayload)
      .eq("id", aprovacao.produto_id)

    if (erroUpdate) {
      console.error(JSON.stringify({ event: "aprovacao.aprovar.produto.error", error: erroUpdate, aprovacao_id: params.id }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar produto." } },
        { status: 500 }
      )
    }

    // Atualiza imagens se vieram na aprovação
    if (Array.isArray(novos.imagens) && novos.imagens.length > 0) {
      // Remove imagens antigas
      await supabase
        .from("produto_imagens")
        .delete()
        .eq("produto_id", aprovacao.produto_id)

      // Insere imagens novas
      const imagensPayload = (novos.imagens as Array<{ url: string; public_id: string }>).map(
        (img, idx) => ({
          produto_id: aprovacao.produto_id,
          url_cloudinary: img.url,
          public_id: img.public_id,
          ordem: idx,
        })
      )
      await supabase.from("produto_imagens").insert(imagensPayload)
    }

    // Fecha a aprovação
    const { error: erroAprovacao } = await supabase
      .from("aprovacoes")
      .update({ status: "aprovado", resolved_at: now })
      .eq("id", params.id)

    if (erroAprovacao) {
      console.error(JSON.stringify({ event: "aprovacao.aprovar.status.error", error: erroAprovacao, aprovacao_id: params.id }))
    }

    console.log(JSON.stringify({
      event: "aprovacao.aprovada",
      aprovacao_id: params.id,
      produto_id: aprovacao.produto_id,
      master_id: adminUser.id,
      timestamp: now,
    }))

    return Response.json({ success: true, data: { acao: "aprovado" } })

  } else {
    // Rejeitar
    const { error: erroAprovacao } = await supabase
      .from("aprovacoes")
      .update({
        status: "rejeitado",
        motivo_rejeicao: parsed.data.motivo,
        resolved_at: now,
      })
      .eq("id", params.id)

    if (erroAprovacao) {
      console.error(JSON.stringify({ event: "aprovacao.rejeitar.error", error: erroAprovacao, aprovacao_id: params.id }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao rejeitar aprovação." } },
        { status: 500 }
      )
    }

    // Volta o produto para rejeitado
    await supabase
      .from("produtos")
      .update({ status: "rejeitado", updated_at: now })
      .eq("id", aprovacao.produto_id)

    console.log(JSON.stringify({
      event: "aprovacao.rejeitada",
      aprovacao_id: params.id,
      produto_id: aprovacao.produto_id,
      master_id: adminUser.id,
      motivo: parsed.data.motivo,
      timestamp: now,
    }))

    return Response.json({ success: true, data: { acao: "rejeitado" } })
  }
}
