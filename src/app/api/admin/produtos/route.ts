import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ── Zod schemas ───────────────────────────────────────────────────────────────

const imagemSchema = z.object({
  url: z.string().url(),
  public_id: z.string().min(1),
})

const baseSchema = z.object({
  nome: z.string().min(10, "Nome deve ter pelo menos 10 caracteres."),
  specs: z.string().min(1, "Especificações são obrigatórias."),
  descricao: z.string().min(1, "Descrição comercial é obrigatória."),
  tipo: z.enum(["tipo_a", "tipo_b"]),
  categoria: z.string().min(1, "Categoria é obrigatória."),
  imagens: z.array(imagemSchema).min(1, "Adicione ao menos uma imagem."),
  status_solicitado: z.enum(["rascunho", "pendente", "publicado"]).optional(),
})

const tipoASchema = baseSchema.extend({
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

const tipoBSchema = baseSchema.extend({
  tipo: z.literal("tipo_b"),
  quantidade: z.number().int().positive("Quantidade deve ser maior que zero."),
})

const produtoSchema = z.discriminatedUnion("tipo", [tipoASchema, tipoBSchema])

// ── Slug ─────────────────────────────────────────────────────────────────────

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

async function gerarSlugUnico(
  supabase: ReturnType<typeof createClient>,
  nome: string
): Promise<string> {
  const base = gerarSlugBase(nome)
  let slug = base
  let tentativa = 0

  while (true) {
    const { data } = await supabase
      .from("produtos")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (!data) return slug

    tentativa++
    slug = `${base}-${tentativa}`
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
      { status: 401 }
    )
  }

  // Verifica role admin
  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("role")
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

  // Parse do body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Body inválido." } },
      { status: 400 }
    )
  }

  // Validação Zod
  const parsed = produtoSchema.safeParse(body)
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

  // Determina status: Auxiliar sempre fica pendente ou rascunho; Master pode publicar
  const statusSolicitado = (body as Record<string, unknown>).status_solicitado as string | undefined
  let status: "rascunho" | "pendente" | "publicado"

  if (statusSolicitado === "rascunho") {
    status = "rascunho"
  } else if (isMaster) {
    status = statusSolicitado === "publicado" ? "publicado" : "rascunho"
  } else {
    // Auxiliar só pode rascunho ou pendente
    status = statusSolicitado === "pendente" ? "pendente" : "rascunho"
  }

  // Gera slug único
  const slug = await gerarSlugUnico(supabase, dados.nome)

  // Monta o objeto do produto
  const produtoPayload: Record<string, unknown> = {
    nome: dados.nome,
    slug,
    descricao: dados.descricao,
    specs_tecnicas: dados.specs,
    tipo: dados.tipo,
    categoria: dados.categoria,
    status,
    criado_por: user.id,
    ...(status === "publicado" ? { aprovado_por: user.id } : {}),
  }

  if (dados.tipo === "tipo_a") {
    produtoPayload.preco_ml = dados.preco_ml
    produtoPayload.preco_site = Math.round(dados.preco_ml * 0.82 * 100) / 100
    produtoPayload.url_ml = dados.url_ml
    produtoPayload.estoque = dados.estoque
  } else {
    produtoPayload.estoque = dados.quantidade
  }

  // Insere o produto
  const { data: produto, error: erroProduto } = await supabase
    .from("produtos")
    .insert(produtoPayload)
    .select("id, slug, status")
    .single()

  if (erroProduto || !produto) {
    console.error(JSON.stringify({ event: "produto.insert.error", error: erroProduto, user_id: user.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao salvar produto. Tente novamente." } },
      { status: 500 }
    )
  }

  // Insere imagens na tabela produto_imagens
  if (dados.imagens.length > 0) {
    const imagensPayload = dados.imagens.map((img, idx) => ({
      produto_id: produto.id,
      url_cloudinary: img.url,
      public_id: img.public_id,
      ordem: idx,
    }))

    const { error: erroImagens } = await supabase
      .from("produto_imagens")
      .insert(imagensPayload)

    if (erroImagens) {
      console.error(JSON.stringify({ event: "produto.imagens.insert.error", error: erroImagens, produto_id: produto.id }))
      // Produto foi salvo — não falha a requisição, mas loga
    }
  }

  // Log estruturado
  console.log(JSON.stringify({
    event: "produto.salvo",
    produto_id: produto.id,
    slug: produto.slug,
    status: produto.status,
    admin_id: user.id,
    role: adminUser.role,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: produto.id, slug: produto.slug, status: produto.status } })
}
