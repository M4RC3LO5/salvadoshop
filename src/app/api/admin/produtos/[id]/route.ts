import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({ secure: true })

// ── Schemas compartilhados ─────────────────────────────────────────────────────

const imagemSchema = z.object({
  url: z.string().url(),
  public_id: z.string().min(1),
})

const baseEditSchema = z.object({
  nome: z.string().min(10, "Nome deve ter pelo menos 10 caracteres."),
  specs: z.string().min(1, "Especificações são obrigatórias."),
  descricao: z.string().min(1, "Descrição comercial é obrigatória."),
  tipo: z.enum(["tipo_a", "tipo_b"]),
  categoria: z.string().min(1, "Categoria é obrigatória."),
  imagens: z.array(imagemSchema).min(1, "Adicione ao menos uma imagem."),
  status_solicitado: z.enum(["rascunho", "pendente", "publicado"]).optional(),
})

const tipoAEditSchema = baseEditSchema.extend({
  tipo: z.literal("tipo_a"),
  preco_ml: z.number().positive("Preço ML deve ser maior que zero."),
  url_ml: z.string().refine((url) => {
    try {
      const host = new URL(url).hostname.replace("www.", "")
      return host === "mercadolivre.com.br" || host === "produto.mercadolivre.com.br"
    } catch {
      return false
    }
  }, "URL deve ser do mercadolivre.com.br"),
  estoque: z.number().int().min(0),
})

const tipoBEditSchema = baseEditSchema.extend({
  tipo: z.literal("tipo_b"),
  quantidade: z.number().int().positive("Quantidade deve ser maior que zero."),
})

const produtoEditSchema = z.discriminatedUnion("tipo", [tipoAEditSchema, tipoBEditSchema])

// ── PUT — editar produto completo ─────────────────────────────────────────────

export async function PUT(
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

  const isMaster = adminUser.role === "master"

  // Busca produto atual (para snapshot e verificação de existência)
  const { data: produtoAtual } = await supabase
    .from("produtos")
    .select("id, nome, slug, descricao, specs_tecnicas, tipo, categoria, preco_ml, url_ml, estoque, quantidade_lote, status, criado_por")
    .eq("id", params.id)
    .single()

  if (!produtoAtual) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Produto não encontrado." } },
      { status: 404 }
    )
  }

  // Auxiliar só pode editar seus próprios produtos
  if (!isMaster && produtoAtual.criado_por !== adminUser.id) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Você só pode editar seus próprios produtos." } },
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

  const parsed = produtoEditSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: firstError?.message ?? "Dados inválidos.",
          details: parsed.error.issues,
        },
      },
      { status: 422 }
    )
  }

  const dados = parsed.data
  const statusSolicitado = (body as Record<string, unknown>).status_solicitado as string | undefined

  // Busca imagens atuais do produto
  const { data: imagensAtuais } = await supabase
    .from("produto_imagens")
    .select("id, url_cloudinary, public_id, ordem")
    .eq("produto_id", params.id)
    .order("ordem")

  const publicIdsAtuais = new Set((imagensAtuais ?? []).map((i) => i.public_id))
  const publicIdsNovos = new Set(dados.imagens.map((i) => i.public_id))

  // Imagens removidas: estavam antes, não estão mais
  const imagensRemovidas = (imagensAtuais ?? []).filter((i) => !publicIdsNovos.has(i.public_id))
  // Imagens adicionadas: estão agora, não estavam antes
  const imagensAdicionadas = dados.imagens.filter((i) => !publicIdsAtuais.has(i.public_id))

  if (isMaster) {
    // ── Master: atualiza diretamente ──────────────────────────────────────────

    let status: "rascunho" | "pendente" | "publicado"
    if (statusSolicitado === "rascunho") {
      status = "rascunho"
    } else if (statusSolicitado === "publicado") {
      status = "publicado"
    } else {
      status = produtoAtual.status as "rascunho" | "pendente" | "publicado"
    }

    const produtoPayload: Record<string, unknown> = {
      nome: dados.nome,
      descricao: dados.descricao,
      specs_tecnicas: { texto: dados.specs },
      tipo: dados.tipo,
      categoria: dados.categoria,
      status,
      updated_at: new Date().toISOString(),
      ...(status === "publicado" ? { aprovado_por: adminUser.id } : {}),
    }

    if (dados.tipo === "tipo_a") {
      produtoPayload.preco_ml = dados.preco_ml
      produtoPayload.url_ml = dados.url_ml
      produtoPayload.estoque = dados.estoque
      produtoPayload.quantidade_lote = null
    } else {
      produtoPayload.quantidade_lote = dados.quantidade
      produtoPayload.preco_ml = null
      produtoPayload.url_ml = null
      produtoPayload.estoque = 0
    }

    const { error: erroUpdate } = await supabase
      .from("produtos")
      .update(produtoPayload)
      .eq("id", params.id)

    if (erroUpdate) {
      console.error(JSON.stringify({ event: "produto.put.error", error: erroUpdate, produto_id: params.id }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar produto." } },
        { status: 500 }
      )
    }

    // Remove imagens excluídas
    if (imagensRemovidas.length > 0) {
      await supabase
        .from("produto_imagens")
        .delete()
        .in("public_id", imagensRemovidas.map((i) => i.public_id))

      const publicIdsParaDeletar = imagensRemovidas.map((i) => i.public_id).filter(Boolean)
      if (publicIdsParaDeletar.length > 0) {
        try {
          await cloudinary.api.delete_resources(publicIdsParaDeletar)
        } catch (err) {
          console.error(JSON.stringify({ event: "cloudinary.delete.error", error: err, produto_id: params.id }))
        }
      }
    }

    // Insere imagens novas
    if (imagensAdicionadas.length > 0) {
      const payload = imagensAdicionadas.map((img) => ({
        produto_id: params.id,
        url_cloudinary: img.url,
        public_id: img.public_id,
        ordem: dados.imagens.findIndex((i) => i.public_id === img.public_id),
      }))
      await supabase.from("produto_imagens").insert(payload)
    }

    // Atualiza ordem das imagens restantes
    await Promise.all(
      dados.imagens
        .filter((img) => publicIdsAtuais.has(img.public_id))
        .map((img, idx) =>
          supabase
            .from("produto_imagens")
            .update({ ordem: idx })
            .eq("produto_id", params.id)
            .eq("public_id", img.public_id)
        )
    )

    console.log(JSON.stringify({
      event: "produto.editado",
      produto_id: params.id,
      admin_id: adminUser.id,
      role: "master",
      timestamp: new Date().toISOString(),
    }))

    return Response.json({
      success: true,
      data: { id: params.id, slug: produtoAtual.slug, status, pendente_aprovacao: false },
    })

  } else {
    // ── Auxiliar: cria registro na fila de aprovações ─────────────────────────

    const dadosNovos: Record<string, unknown> = {
      nome: dados.nome,
      descricao: dados.descricao,
      specs_tecnicas: { texto: dados.specs },
      tipo: dados.tipo,
      categoria: dados.categoria,
      imagens: dados.imagens,
    }

    if (dados.tipo === "tipo_a") {
      dadosNovos.preco_ml = dados.preco_ml
      dadosNovos.url_ml = dados.url_ml
      dadosNovos.estoque = dados.estoque
    } else {
      dadosNovos.quantidade_lote = dados.quantidade
    }

    const { error: erroAprovacao } = await supabase
      .from("aprovacoes")
      .insert({
        produto_id: params.id,
        admin_id: adminUser.id,
        tipo_alteracao: "edicao",
        dados_anteriores: produtoAtual,
        dados_novos: dadosNovos,
        status: "pendente",
      })

    if (erroAprovacao) {
      console.error(JSON.stringify({ event: "aprovacao.insert.error", error: erroAprovacao, produto_id: params.id }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao enviar para aprovação." } },
        { status: 500 }
      )
    }

    console.log(JSON.stringify({
      event: "produto.edicao_pendente",
      produto_id: params.id,
      admin_id: adminUser.id,
      role: "auxiliar",
      timestamp: new Date().toISOString(),
    }))

    return Response.json({
      success: true,
      data: { id: params.id, slug: produtoAtual.slug, status: "pendente", pendente_aprovacao: true },
    })
  }
}

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
