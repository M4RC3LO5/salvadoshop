import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ── Schemas ──────────────────────────────────────────────────────────────────

const itemIndividualSchema = z.object({
  estoque_item_id: z.string().uuid(),
  preco_ml: z.number().positive("Preço ML deve ser maior que zero."),
  // preco_site é coluna gerada no banco (preco_ml * 0,82) — aceito aqui apenas
  // para o cliente conferir o valor exibido, nunca é usado na gravação.
  preco_site: z.number().positive().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória."),
  descricao: z.string().min(1, "Descrição é obrigatória."),
})

const modoIndividualSchema = z.object({
  modo: z.literal("individual"),
  itens: z.array(itemIndividualSchema).min(1, "Selecione ao menos um item."),
})

const modoLoteSchema = z.object({
  modo: z.literal("lote"),
  estoque_item_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um item."),
  nome: z.string().min(1, "Nome do lote é obrigatório."),
  descricao: z.string().min(1, "Descrição é obrigatória."),
  categoria: z.string().min(1, "Categoria é obrigatória."),
})

const bodySchema = z.discriminatedUnion("modo", [modoIndividualSchema, modoLoteSchema])

// ── Slug (mesmo padrão de /api/admin/produtos) ──────────────────────────────

function gerarSlugBase(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

async function gerarSlugUnico(supabase: ReturnType<typeof createClient>, nome: string): Promise<string> {
  const base = gerarSlugBase(nome)
  let slug = base
  let tentativa = 0
  while (true) {
    const { data } = await supabase.from("produtos").select("id").eq("slug", slug).maybeSingle()
    if (!data) return slug
    tentativa++
    slug = `${base}-${tentativa}`
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

interface EstoqueItemRow {
  id: string
  nome: string
  total_unidades: number
}

interface LigacaoAtiva {
  id: string
  estoque_item_id: string
  produto_id: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Rastreamento para rollback manual (compensação — não há transação cross-serviço
  // possível aqui, já que o upload no Cloudinary é uma chamada HTTP externa)
  const produtosCriados: string[] = []
  const ligacoesCriadas: string[] = []
  const ligacoesDesativadas: string[] = []
  const produtosOcultados: { id: string } [] = []

  async function reverterTudo() {
    if (ligacoesCriadas.length > 0) {
      await supabase.from("estoque_item_produtos").delete().in("id", ligacoesCriadas)
    }
    if (ligacoesDesativadas.length > 0) {
      await supabase.from("estoque_item_produtos").update({ ativo: true }).in("id", ligacoesDesativadas)
    }
    if (produtosOcultados.length > 0) {
      await supabase.from("produtos").update({ status: "publicado" }).in("id", produtosOcultados.map((p) => p.id))
    }
    if (produtosCriados.length > 0) {
      // ON DELETE CASCADE remove produto_imagens e estoque_item_produtos associados
      await supabase.from("produtos").delete().in("id", produtosCriados)
    }
  }

  try {
    // Autenticação
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
    const status: "publicado" | "pendente" = isMaster ? "publicado" : "pendente"

    // Body
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
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
            details: parsed.error.flatten(),
          },
        },
        { status: 422 }
      )
    }

    const dados = parsed.data
    const idsEnvolvidos = dados.modo === "individual"
      ? dados.itens.map((i) => i.estoque_item_id)
      : dados.estoque_item_ids

    // Busca os itens de estoque envolvidos — todos precisam existir
    const { data: itensEstoque, error: itensError } = await supabase
      .from("estoque_itens")
      .select("id, nome, total_unidades")
      .in("id", idsEnvolvidos)

    if (itensError) {
      console.error(JSON.stringify({ event: "triagem.publicar.itens.error", error: itensError }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao buscar os itens selecionados." } },
        { status: 500 }
      )
    }

    const itensPorId = new Map<string, EstoqueItemRow>((itensEstoque ?? []).map((i) => [i.id, i]))
    const idsFaltando = idsEnvolvidos.filter((id) => !itensPorId.has(id))
    if (idsFaltando.length > 0) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Um ou mais itens selecionados não foram encontrados." } },
        { status: 422 }
      )
    }

    // ── Exclusividade: desativa ligações ativas existentes desses itens ──────
    const { data: ligacoesAtivas, error: ligacoesError } = await supabase
      .from("estoque_item_produtos")
      .select("id, estoque_item_id, produto_id")
      .in("estoque_item_id", idsEnvolvidos)
      .eq("ativo", true)

    if (ligacoesError) {
      console.error(JSON.stringify({ event: "triagem.publicar.ligacoes.error", error: ligacoesError }))
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao verificar publicações existentes." } },
        { status: 500 }
      )
    }

    const ligacoes = (ligacoesAtivas ?? []) as LigacaoAtiva[]
    const ocultadosResposta: { id: string; nome: string; slug: string }[] = []

    if (ligacoes.length > 0) {
      const { error: desativarError } = await supabase
        .from("estoque_item_produtos")
        .update({ ativo: false })
        .in("id", ligacoes.map((l) => l.id))

      if (desativarError) {
        console.error(JSON.stringify({ event: "triagem.publicar.desativar.error", error: desativarError }))
        return Response.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao desativar publicações anteriores." } },
          { status: 500 }
        )
      }
      ligacoesDesativadas.push(...ligacoes.map((l) => l.id))

      // Para cada produto antigo afetado, oculta apenas se não sobrou nenhuma ligação ativa
      const produtoIdsAfetados = Array.from(new Set(ligacoes.map((l) => l.produto_id)))
      for (const produtoId of produtoIdsAfetados) {
        const { count } = await supabase
          .from("estoque_item_produtos")
          .select("id", { count: "exact", head: true })
          .eq("produto_id", produtoId)
          .eq("ativo", true)

        if ((count ?? 0) > 0) continue // lote ainda tem outros itens ativos — não oculta

        const { data: produtoAntigo } = await supabase
          .from("produtos")
          .select("id, nome, slug, status")
          .eq("id", produtoId)
          .single()

        if (!produtoAntigo || produtoAntigo.status !== "publicado") continue

        const { error: ocultarError } = await supabase
          .from("produtos")
          .update({ status: "rascunho" })
          .eq("id", produtoId)

        if (ocultarError) {
          console.error(JSON.stringify({ event: "triagem.publicar.ocultar.error", error: ocultarError, produto_id: produtoId }))
          await reverterTudo()
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao ocultar a publicação anterior." } },
            { status: 500 }
          )
        }

        produtosOcultados.push({ id: produtoId })
        ocultadosResposta.push({ id: produtoAntigo.id, nome: produtoAntigo.nome, slug: produtoAntigo.slug })
      }
    }

    const produtosCriadosResposta: { id: string; slug: string; tipo: "tipo_a" | "tipo_b"; status: string }[] = []

    // ── Modo individual — um produto tipo_a por item ─────────────────────────
    if (dados.modo === "individual") {
      for (const itemInput of dados.itens) {
        const itemEstoque = itensPorId.get(itemInput.estoque_item_id)!

        const slug = await gerarSlugUnico(supabase, itemEstoque.nome)
        const { data: produto, error: produtoError } = await supabase
          .from("produtos")
          .insert({
            nome: itemEstoque.nome,
            slug,
            descricao: itemInput.descricao,
            tipo: "tipo_a",
            categoria: itemInput.categoria,
            preco_ml: itemInput.preco_ml,
            estoque: itemEstoque.total_unidades,
            status,
            criado_por: adminUser.id,
            ...(status === "publicado" ? { aprovado_por: adminUser.id } : {}),
          })
          .select("id, slug, status")
          .single()

        if (produtoError || !produto) {
          console.error(JSON.stringify({ event: "triagem.publicar.produto.error", error: produtoError }))
          await reverterTudo()
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao publicar o produto. Tente novamente." } },
            { status: 500 }
          )
        }
        produtosCriados.push(produto.id)

        const { data: ligacao, error: ligacaoError } = await supabase
          .from("estoque_item_produtos")
          .insert({ estoque_item_id: itemEstoque.id, produto_id: produto.id, ativo: true })
          .select("id")
          .single()

        if (ligacaoError || !ligacao) {
          console.error(JSON.stringify({ event: "triagem.publicar.ligacao.error", error: ligacaoError }))
          await reverterTudo()
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao vincular o item ao produto." } },
            { status: 500 }
          )
        }
        ligacoesCriadas.push(ligacao.id)

        produtosCriadosResposta.push({ id: produto.id, slug: produto.slug, tipo: "tipo_a", status: produto.status })
      }
    }

    // ── Modo lote — um único produto tipo_b para todos os itens ─────────────
    if (dados.modo === "lote") {
      const itensDoLote = dados.estoque_item_ids.map((id) => itensPorId.get(id)!)
      const quantidadeLote = itensDoLote.reduce((soma, i) => soma + i.total_unidades, 0)

      const slug = await gerarSlugUnico(supabase, dados.nome)
      const { data: produto, error: produtoError } = await supabase
        .from("produtos")
        .insert({
          nome: dados.nome,
          slug,
          descricao: dados.descricao,
          tipo: "tipo_b",
          categoria: dados.categoria,
          quantidade_lote: quantidadeLote,
          estoque: 0,
          status,
          criado_por: adminUser.id,
          ...(status === "publicado" ? { aprovado_por: adminUser.id } : {}),
        })
        .select("id, slug, status")
        .single()

      if (produtoError || !produto) {
        console.error(JSON.stringify({ event: "triagem.publicar.produto.error", error: produtoError }))
        await reverterTudo()
        return Response.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao publicar o lote. Tente novamente." } },
          { status: 500 }
        )
      }
      produtosCriados.push(produto.id)

      const ligacoesPayload = itensDoLote.map((i) => ({ estoque_item_id: i.id, produto_id: produto.id, ativo: true }))
      const { data: ligacoesInseridas, error: ligacaoError } = await supabase
        .from("estoque_item_produtos")
        .insert(ligacoesPayload)
        .select("id")

      if (ligacaoError || !ligacoesInseridas) {
        console.error(JSON.stringify({ event: "triagem.publicar.ligacao.error", error: ligacaoError }))
        await reverterTudo()
        return Response.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao vincular os itens ao lote." } },
          { status: 500 }
        )
      }
      ligacoesCriadas.push(...ligacoesInseridas.map((l) => l.id))

      produtosCriadosResposta.push({ id: produto.id, slug: produto.slug, tipo: "tipo_b", status: produto.status })
    }

    console.log(JSON.stringify({
      event: "triagem.publicado",
      modo: dados.modo,
      produtos: produtosCriadosResposta.map((p) => p.id),
      ocultados: ocultadosResposta.map((p) => p.id),
      admin_id: adminUser.id,
      role: adminUser.role,
      timestamp: new Date().toISOString(),
    }))

    return Response.json({
      success: true,
      data: { produtos: produtosCriadosResposta, ocultados: ocultadosResposta },
    })
  } catch (err) {
    console.error(JSON.stringify({ event: "triagem.publicar.erro_inesperado", error: String(err) }))
    await reverterTudo()
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Falha ao publicar. Nenhuma alteração foi salva." } },
      { status: 500 }
    )
  }
}
