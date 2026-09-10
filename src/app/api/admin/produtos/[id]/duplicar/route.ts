import { NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// ── Slug ─────────────────────────────────────────────────────────────────────
// Mesma lógica de src/app/api/admin/produtos/route.ts — mantida local para não
// acoplar as duas rotas a um helper compartilhado por uma função pequena.

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

// Colisão de slug entre clones: a primeira cópia fica só com "-copia"; a
// segunda cópia do MESMO produto original colidiria com essa e vira
// "-copia-2", a terceira "-copia-3", e assim por diante (nunca "-copia-1" —
// o "-copia" sem número já é a primeira).
async function gerarSlugUnicoClone(
  supabase: ReturnType<typeof createClient>,
  nome: string
): Promise<string> {
  const base = gerarSlugBase(nome)

  const { data: semSufixo } = await supabase
    .from("produtos")
    .select("id")
    .eq("slug", base)
    .maybeSingle()

  if (!semSufixo) return base

  let tentativa = 2
  while (true) {
    const slug = `${base}-${tentativa}`
    const { data } = await supabase
      .from("produtos")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (!data) return slug

    tentativa++
  }
}

// ── POST — duplicar produto ───────────────────────────────────────────────────

export async function POST(
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

  if (!adminUser) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
      { status: 403 }
    )
  }

  // Somente Master duplica — Auxiliar cadastra/edita, mas não publica nem clona.
  if (adminUser.role !== "master") {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Apenas Masters podem duplicar produtos." } },
      { status: 403 }
    )
  }

  // Busca produto original — somente colunas que serão copiadas.
  // Excluídos propositalmente: id, slug, url_ml, status, estoque,
  // aprovado_por, created_at, updated_at.
  const { data: produtoOriginal, error: erroBusca } = await supabase
    .from("produtos")
    .select("nome, descricao, specs_tecnicas, tipo, preco_ml, preco_site, categoria, categoria_id, sinistro, quantidade_lote")
    .eq("id", params.id)
    .single()

  if (erroBusca || !produtoOriginal) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Produto não encontrado." } },
      { status: 404 }
    )
  }

  const novoNome = `${produtoOriginal.nome} (Cópia)`
  const novoSlug = await gerarSlugUnicoClone(supabase, novoNome)

  const produtoPayload = {
    nome: novoNome,
    slug: novoSlug,
    descricao: produtoOriginal.descricao,
    specs_tecnicas: produtoOriginal.specs_tecnicas,
    tipo: produtoOriginal.tipo,
    categoria: produtoOriginal.categoria,
    categoria_id: produtoOriginal.categoria_id,
    sinistro: produtoOriginal.sinistro,
    // Tipo A: preço no site copiado como ponto de partida, mas sem URL do ML
    // (não pode apontar pro mesmo anúncio). O clone sempre nasce exclusivo do
    // site — sem URL do ML não há como ele ser "anunciado no ML" — então
    // preco_ml não é copiado (produto exclusivo não tem preço de ML).
    preco_ml: null,
    preco_site: produtoOriginal.tipo === "tipo_a" ? produtoOriginal.preco_site : null,
    url_ml: null,
    exclusivo_site: true,
    quantidade_lote: produtoOriginal.tipo === "tipo_b" ? produtoOriginal.quantidade_lote : null,
    estoque: 0,
    status: "rascunho" as const,
    criado_por: adminUser.id,
    aprovado_por: null,
  }

  const { data: produtoNovo, error: erroInsert } = await supabase
    .from("produtos")
    .insert(produtoPayload)
    .select("id")
    .single()

  if (erroInsert || !produtoNovo) {
    console.error(JSON.stringify({ event: "produto.duplicar.insert.error", error: erroInsert, produto_id: params.id }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao duplicar produto." } },
      { status: 500 }
    )
  }

  // Imagens não são copiadas: produto_imagens.public_id tem constraint UNIQUE
  // global (não composta com produto_id), então duas linhas não podem apontar
  // para o mesmo public_id. Além disso, as rotas de exclusão de imagem
  // (PUT/DELETE de produto e /api/admin/deletar-imagem) chamam
  // cloudinary.destroy direto pelo public_id sem checar se outro produto
  // ainda referencia o mesmo arquivo — compartilhar a linha arriscaria apagar
  // a foto do produto original ao editar/excluir o clone. O admin reenvia as
  // fotos manualmente na tela de edição do clone.

  console.log(JSON.stringify({
    event: "produto.duplicado",
    produto_original_id: params.id,
    produto_novo_id: produtoNovo.id,
    admin_id: adminUser.id,
    role: "master",
    timestamp: new Date().toISOString(),
  }))

  revalidatePath("/admin/produtos")

  return Response.json({ success: true, data: { id: produtoNovo.id } })
}
