import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ESTADOS = ["lacrado", "avaria_leve", "avaria_grave", "sucata"] as const
const ORIGENS = ["sinistro", "fabricante", "ecommerce", "atacado", "avulso"] as const
const TIPOS_CAPTURA = ["etiqueta", "item_avulso"] as const

const bodySchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  marca: z.string().nullable(),
  sku: z.string().nullable(),
  ean: z.string().nullable(),
  qtd_embalagem: z.number().int().positive().nullable(),
  num_caixas: z.number().int().positive().nullable(),
  lote: z.string().nullable(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de validade inválida.").nullable(),
  estado: z.enum(ESTADOS).nullable(),
  estado_livre: z.string().nullable(),
  observacoes: z.string().nullable(),
  custo_unitario: z.number().nonnegative().nullable(),
  origem: z.enum(ORIGENS).nullable(),
  fornecedor: z.string().nullable(),
  tipo_captura: z.enum(TIPOS_CAPTURA),
  campos_ia: z.string().nullable(),
  lista_id: z.string().uuid().nullable(),
})

// ── Helpers de leitura do multipart ─────────────────────────────────────────

function campoTexto(formData: FormData, chave: string): string | null {
  const valor = formData.get(chave)
  if (typeof valor !== "string") return null
  const texto = valor.trim()
  return texto === "" ? null : texto
}

function campoNumero(formData: FormData, chave: string): number | null {
  const texto = campoTexto(formData, chave)
  if (texto === null) return null
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

function nomeListaHoje(): string {
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())
  return `Triagem ${hoje}`
}

const SEGUNDOS_URL_ASSINADA = 60 * 60 // 1 hora

// ── GET — itens de uma lista, ordenados por "ordem" ─────────────────────────

export async function GET(request: NextRequest) {
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

  const listaId = request.nextUrl.searchParams.get("lista_id")
  if (!listaId || !z.string().uuid().safeParse(listaId).success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "lista_id é obrigatório e deve ser um UUID válido." } },
      { status: 422 }
    )
  }

  const { data: itens, error } = await supabase
    .from("estoque_itens")
    .select(`
      *,
      publicacao:estoque_item_produtos(
        ativo,
        produto:produtos(id, slug, tipo, status)
      )
    `)
    .eq("lista_id", listaId)
    .eq("publicacao.ativo", true)
    .order("ordem", { ascending: true })

  if (error) {
    console.error(JSON.stringify({ event: "triagem.itens.get.error", error, lista_id: listaId }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao buscar os itens da lista." } },
      { status: 500 }
    )
  }

  // Gera URLs assinadas para as fotos — o bucket "triagem" é privado
  const caminhos = (itens ?? []).map((item) => item.foto_url).filter(Boolean)
  const urlsPorCaminho = new Map<string, string>()

  if (caminhos.length > 0) {
    const { data: assinadas } = await supabase.storage
      .from("triagem")
      .createSignedUrls(caminhos, SEGUNDOS_URL_ASSINADA)

    assinadas?.forEach((item) => {
      if (item.signedUrl) urlsPorCaminho.set(item.path ?? "", item.signedUrl)
    })
  }

  const itensFormatados = (itens ?? []).map((item) => {
    const { publicacao, ...resto } = item as typeof item & {
      publicacao: { ativo: boolean; produto: { id: string; slug: string; tipo: string; status: string } | null }[]
    }
    return {
      ...resto,
      foto_url: urlsPorCaminho.get(resto.foto_url) ?? null,
      produto_ativo: publicacao?.[0]?.produto ?? null,
    }
  })

  return Response.json({ success: true, data: itensFormatados })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  let caminhoFoto: string | null = null

  try {
    // 1) Autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Autenticação necessária." } },
        { status: 401 }
      )
    }

    // Lê o multipart
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Formato de requisição inválido." } },
        { status: 400 }
      )
    }

    // 2) Validação — foto
    const foto = formData.get("foto")
    if (!(foto instanceof File)) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Foto é obrigatória." } },
        { status: 422 }
      )
    }
    if (!ALLOWED_TYPES.includes(foto.type)) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Formato de imagem inválido. Use JPG, PNG ou WEBP." } },
        { status: 422 }
      )
    }
    if (foto.size > MAX_BYTES) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Imagem muito grande. Máximo 10MB." } },
        { status: 422 }
      )
    }

    // 2) Validação — demais campos
    const parsed = bodySchema.safeParse({
      nome: campoTexto(formData, "nome") ?? "",
      marca: campoTexto(formData, "marca"),
      sku: campoTexto(formData, "sku"),
      ean: campoTexto(formData, "ean"),
      qtd_embalagem: campoNumero(formData, "qtd_embalagem"),
      num_caixas: campoNumero(formData, "num_caixas"),
      lote: campoTexto(formData, "lote"),
      validade: campoTexto(formData, "validade"),
      estado: campoTexto(formData, "estado"),
      estado_livre: campoTexto(formData, "estado_livre"),
      observacoes: campoTexto(formData, "observacoes"),
      custo_unitario: campoNumero(formData, "custo_unitario"),
      origem: campoTexto(formData, "origem"),
      fornecedor: campoTexto(formData, "fornecedor"),
      tipo_captura: campoTexto(formData, "tipo_captura") ?? "",
      campos_ia: campoTexto(formData, "campos_ia"),
      lista_id: campoTexto(formData, "lista_id"),
    })

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados inválidos.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      )
    }

    const dados = parsed.data

    // campos_ia vem como texto JSON — inválido não deve travar a gravação, mas também não deve ser aceito silenciosamente
    let camposIA: unknown = null
    if (dados.campos_ia) {
      try {
        camposIA = JSON.parse(dados.campos_ia)
      } catch {
        return Response.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "campos_ia não é um JSON válido." } },
          { status: 422 }
        )
      }
    }

    // 4) admin_usuarios — criado_por referencia admin_usuarios.id, não auth.users
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_usuarios")
      .select("id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .single()

    if (adminError || !adminUser) {
      return Response.json(
        { success: false, error: { code: "FORBIDDEN", message: "Acesso negado." } },
        { status: 403 }
      )
    }

    // 3) Upload da foto — bucket privado "triagem"
    const bytes = await foto.arrayBuffer()
    const buffer = Buffer.from(bytes)
    caminhoFoto = `${user.id}/${randomUUID()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from("triagem")
      .upload(caminhoFoto, buffer, { contentType: "image/jpeg", upsert: false })

    if (uploadError) {
      caminhoFoto = null
      return Response.json(
        { success: false, error: { code: "UPLOAD_FAILED", message: "Falha ao enviar a foto. Tente novamente." } },
        { status: 500 }
      )
    }

    // 5) Resolve a lista — cria uma nova se lista_id não veio
    let listaId = dados.lista_id
    if (!listaId) {
      const { data: novaLista, error: listaError } = await supabase
        .from("triagem_listas")
        .insert({ nome: nomeListaHoje(), criado_por: adminUser.id })
        .select("id")
        .single()

      if (listaError || !novaLista) {
        await removerFotoOrfa(supabase, caminhoFoto)
        return Response.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível criar a lista de triagem." } },
          { status: 500 }
        )
      }
      listaId = novaLista.id
    }

    // 6) Ordem — maior ordem da lista + 1
    const { data: ultimoItem, error: ordemError } = await supabase
      .from("estoque_itens")
      .select("ordem")
      .eq("lista_id", listaId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ordemError) {
      await removerFotoOrfa(supabase, caminhoFoto)
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível calcular a ordem do item." } },
        { status: 500 }
      )
    }
    const ordem = (ultimoItem?.ordem ?? 0) + 1

    // 7) Insert — total_unidades é coluna gerada, não é enviada
    const { data: itemInserido, error: insertError } = await supabase
      .from("estoque_itens")
      .insert({
        lista_id: listaId,
        ordem,
        foto_url: caminhoFoto,
        tipo_captura: dados.tipo_captura,
        nome: dados.nome,
        marca: dados.marca,
        sku: dados.sku,
        ean: dados.ean,
        qtd_embalagem: dados.qtd_embalagem ?? 1,
        num_caixas: dados.num_caixas ?? 1,
        lote: dados.lote,
        validade: dados.validade,
        estado: dados.estado,
        estado_livre: dados.estado_livre,
        observacoes: dados.observacoes,
        custo_unitario: dados.custo_unitario,
        origem: dados.origem,
        fornecedor: dados.fornecedor,
        campos_ia: camposIA,
        criado_por: adminUser.id,
      })
      .select("id, lista_id, total_unidades")
      .single()

    // 9) Insert falhou — remove a foto já enviada para evitar arquivo órfão
    if (insertError || !itemInserido) {
      await removerFotoOrfa(supabase, caminhoFoto)
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível salvar o item. Tente novamente." } },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: {
        id: itemInserido.id,
        lista_id: itemInserido.lista_id,
        total_unidades: itemInserido.total_unidades,
      },
    })
  } catch {
    if (caminhoFoto) {
      await removerFotoOrfa(supabase, caminhoFoto)
    }
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Falha ao processar a requisição. Tente novamente." } },
      { status: 500 }
    )
  }
}

async function removerFotoOrfa(supabase: ReturnType<typeof createClient>, caminho: string) {
  try {
    await supabase.storage.from("triagem").remove([caminho])
  } catch {
    // best-effort — arquivo órfão não deve impedir o retorno do erro original
  }
}
