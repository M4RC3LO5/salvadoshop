import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ── Schema ────────────────────────────────────────────────────────────────────

const atualizarPedidoSchema = z.object({
  status: z.enum([
    "aguardando_pagamento", "pago", "em_separacao",
    "enviado", "entregue", "cancelado", "reembolsado",
  ]),
  codigo_rastreio: z.string().trim().min(1).max(100).optional(),
  transportadora: z.string().trim().min(1).max(100).optional(),
  url_rastreamento: z.string().url().max(500).optional(),
})

// ── PATCH — atualizar status e dados de rastreio ─────────────────────────────
// A validação de qual transição é permitida para cada papel (Master/Auxiliar)
// vive no trigger `validar_transicao_status_pedido` (migration 008) — esta
// rota apenas traduz a exceção do banco para uma resposta HTTP.

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

  const parsed = atualizarPedidoSchema.safeParse(body)
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

  const { status, codigo_rastreio, transportadora, url_rastreamento } = parsed.data

  const objetoUpdate: Record<string, unknown> = { status }
  if (codigo_rastreio !== undefined) objetoUpdate.codigo_rastreio = codigo_rastreio
  if (transportadora !== undefined) objetoUpdate.transportadora = transportadora
  if (url_rastreamento !== undefined) objetoUpdate.url_rastreamento = url_rastreamento

  const { data, error } = await supabase
    .from("pedidos")
    .update(objetoUpdate)
    .eq("id", params.id)
    .select("id, status")
    .maybeSingle()

  if (error) {
    if (error.message?.includes("TRANSICAO_NAO_PERMITIDA")) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Esta mudança de status não é permitida para o seu perfil ou para a situação atual do pedido.",
          },
        },
        { status: 403 }
      )
    }

    console.error(JSON.stringify({
      event: "admin.pedidos.erro_atualizar",
      pedidoId: params.id,
      error: error.message,
      timestamp: new Date().toISOString(),
    }))

    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar pedido." } },
      { status: 500 }
    )
  }

  if (!data) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Pedido não encontrado ou sem permissão para alterá-lo." } },
      { status: 404 }
    )
  }

  console.log(JSON.stringify({
    event: "admin.pedidos.status_atualizado",
    pedidoId: params.id,
    novoStatus: status,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data })
}
