import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"
import { removerEspecificacoesDuplicadas } from "@/lib/anuncio-ia/especificacoes"

const idSchema = z.uuid()

const textoOpcional = z.string().trim().max(120).nullable()

const dadosSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  marca: textoOpcional,
  modelo: textoOpcional,
  codigo: textoOpcional,
  categoria_id: z.uuid().nullable(),
  especificacoes: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(80),
        valor: z.string().trim().min(1).max(300),
        origem: z.enum(["foto", "print_pedido", "manual"]),
      })
    )
    .max(40),
  conteudo_embalagem: z.array(z.string().trim().min(1).max(120)).max(30),
})

const bodySchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("salvar"), dados: dadosSchema }),
  z.object({ acao: z.literal("descartar") }),
  z.object({ acao: z.literal("converter"), produto_id: z.uuid() }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const id = idSchema.safeParse(params.id)
  if (!id.success) return erroValidacao("Anúncio inválido.")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Requisição inválida.", 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos. Confira os campos.")
  }

  const { supabase, adminUser } = guard

  const { data: atual, error: erroBusca } = await supabase
    .from("anuncios_ia")
    .select("status, dados_ia")
    .eq("id", id.data)
    .maybeSingle()

  if (erroBusca) {
    return erroInterno("anuncio_ia.revisar.busca.error", erroBusca, "Não foi possível carregar o anúncio.")
  }
  if (!atual) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Anúncio não encontrado." } },
      { status: 404 }
    )
  }

  const log = (
    event: "anuncio_ia.revisado" | "anuncio_ia.descartado" | "anuncio_ia.convertido",
    extra: Record<string, unknown> = {}
  ) =>
    console.log(JSON.stringify({
      event,
      anuncio_id: id.data,
      ...extra,
      admin_id: adminUser.id,
      role: adminUser.role,
      timestamp: new Date().toISOString(),
    }))

  if (parsed.data.acao === "descartar") {
    if (atual.status !== "pronto" && atual.status !== "erro") {
      return erroValidacao("Este anúncio não pode ser descartado agora.", 409)
    }

    // Filtro por status no UPDATE: se mudou no meio do caminho, nada é alterado.
    const { data, error } = await supabase
      .from("anuncios_ia")
      .update({ status: "descartado" })
      .eq("id", id.data)
      .in("status", ["pronto", "erro"])
      .select("id")

    if (error) return erroInterno("anuncio_ia.descartar.error", error, "Não foi possível descartar. Tente novamente.")
    if (!data || data.length === 0) return erroValidacao("Este anúncio não pode ser descartado agora.", 409)

    log("anuncio_ia.descartado")
    return Response.json({ success: true, data: { status: "descartado" } })
  }

  if (parsed.data.acao === "converter") {
    if (atual.status !== "pronto") {
      return erroValidacao("Este anúncio não está pronto para virar produto.", 409)
    }

    const produtoId = parsed.data.produto_id
    const { data: produto, error: erroProduto } = await supabase
      .from("produtos")
      .select("id")
      .eq("id", produtoId)
      .maybeSingle()
    if (erroProduto) return erroInterno("anuncio_ia.converter.produto.error", erroProduto, "Não foi possível concluir. Tente novamente.")
    if (!produto) return erroValidacao("Produto não encontrado.")

    const { data: convertido, error: erroConverter } = await supabase
      .from("anuncios_ia")
      .update({ status: "convertido", produto_id: produtoId })
      .eq("id", id.data)
      .eq("status", "pronto")
      .select("id")
    if (erroConverter) return erroInterno("anuncio_ia.converter.error", erroConverter, "Não foi possível concluir. Tente novamente.")
    if (!convertido || convertido.length === 0) {
      return erroValidacao("Este anúncio não está pronto para virar produto.", 409)
    }

    log("anuncio_ia.convertido", { produto_id: produtoId })
    return Response.json({ success: true, data: { status: "convertido" } })
  }

  // acao === "salvar"
  if (atual.status !== "pronto") {
    return erroValidacao("Este anúncio não está pronto para revisão.", 409)
  }

  const dados = parsed.data.dados

  if (dados.categoria_id) {
    const { data: categoria, error: erroCat } = await supabase
      .from("categorias")
      .select("id")
      .eq("id", dados.categoria_id)
      .maybeSingle()
    if (erroCat) return erroInterno("anuncio_ia.revisar.categoria.error", erroCat, "Não foi possível salvar. Tente novamente.")
    if (!categoria) return erroValidacao("Categoria não encontrada. Escolha outra.")
  }

  // MERGE: troca só os campos editáveis; descricao_html, nao_confirmado e pedido seguem como estão.
  const dadosAtuais =
    atual.dados_ia && typeof atual.dados_ia === "object" && !Array.isArray(atual.dados_ia)
      ? (atual.dados_ia as Record<string, unknown>)
      : {}

  const dadosNovos = {
    ...dadosAtuais,
    nome: dados.nome,
    marca: dados.marca,
    modelo: dados.modelo,
    codigo: dados.codigo,
    categoria_id: dados.categoria_id,
    especificacoes: removerEspecificacoesDuplicadas(dados.especificacoes),
    conteudo_embalagem: dados.conteudo_embalagem,
  }

  const { data: salvo, error: erroSalvar } = await supabase
    .from("anuncios_ia")
    .update({ dados_ia: dadosNovos })
    .eq("id", id.data)
    .eq("status", "pronto")
    .select("id")

  if (erroSalvar) return erroInterno("anuncio_ia.revisar.error", erroSalvar, "Não foi possível salvar. Tente novamente.")
  if (!salvo || salvo.length === 0) return erroValidacao("Este anúncio não está pronto para revisão.", 409)

  log("anuncio_ia.revisado")
  return Response.json({ success: true, data: { especificacoes: dadosNovos.especificacoes } })
}
