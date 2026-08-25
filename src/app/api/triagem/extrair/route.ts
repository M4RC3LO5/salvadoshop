import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
type MimeAceito = (typeof ALLOWED_TYPES)[number]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function isMimeAceito(mime: string): mime is MimeAceito {
  return (ALLOWED_TYPES as readonly string[]).includes(mime)
}

type TipoCaptura = "etiqueta" | "item_avulso"

type CampoConfianca = "alta" | "media" | "baixa"

interface CamposExtraidos {
  nome: string | null
  marca: string | null
  sku: string | null
  ean: string | null
  qtd_embalagem: number | null
  lote: string | null
  validade: string | null
}

function montarSystemPrompt(tipoCaptura: TipoCaptura): string {
  const camposEtiqueta = `- "qtd_embalagem": fator multiplicador da embalagem, lido em textos como "CX C/ 12" ou "12X200" (nesse caso o fator é 12, não 200). Se não houver indicação de múltiplo, use 1. Deve ser um número inteiro.
- "lote": código de lote impresso na etiqueta.
- "validade": data de validade no formato ISO AAAA-MM-DD. Se a etiqueta trouxer apenas mês/ano (ex: "MM/AAAA"), use o último dia daquele mês.`

  const camposItemAvulso = `- "qtd_embalagem", "lote" e "validade": SEMPRE retorne null para esses três campos neste modo. Não tente extraí-los da imagem.`

  return `Você é um sistema de extração de dados de produtos a partir de fotos de etiquetas ou itens avulsos, para triagem de estoque de um e-commerce de produtos salvados.

Modo de captura atual: "${tipoCaptura}".

Extraia da imagem os seguintes campos:
- "nome": nome/descrição do produto.
- "marca": marca do produto.
- "sku": código SKU ou código interno do fabricante, se visível.
- "ean": código de barras EAN, se visível.
${tipoCaptura === "etiqueta" ? camposEtiqueta : camposItemAvulso}

REGRAS OBRIGATÓRIAS:
- Retorne SOMENTE um objeto JSON puro, sem markdown, sem blocos de código, sem \`\`\`json, sem nenhum texto antes ou depois.
- Se um campo não puder ser identificado com segurança na imagem, retorne null para ele. NUNCA invente ou estime um valor.
- Para cada campo em "campos", inclua em "confianca" o nível de certeza da extração: "alta", "media" ou "baixa". Se o campo for null, use "baixa".

Formato exato da resposta:
{
  "campos": {
    "nome": string | null,
    "marca": string | null,
    "sku": string | null,
    "ean": string | null,
    "qtd_embalagem": number | null,
    "lote": string | null,
    "validade": string | null
  },
  "confianca": {
    "nome": "alta" | "media" | "baixa",
    "marca": "alta" | "media" | "baixa",
    "sku": "alta" | "media" | "baixa",
    "ean": "alta" | "media" | "baixa",
    "qtd_embalagem": "alta" | "media" | "baixa",
    "lote": "alta" | "media" | "baixa",
    "validade": "alta" | "media" | "baixa"
  }
}`
}

function limparCercasMarkdown(texto: string): string {
  return texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const supabase = createClient()
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

    const foto = formData.get("foto")
    const tipoCapturaRaw = formData.get("tipo_captura")

    if (!(foto instanceof File)) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Nenhuma foto enviada." } },
        { status: 400 }
      )
    }

    if (tipoCapturaRaw !== "etiqueta" && tipoCapturaRaw !== "item_avulso") {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "tipo_captura deve ser 'etiqueta' ou 'item_avulso'." } },
        { status: 422 }
      )
    }

    const tipoCaptura: TipoCaptura = tipoCapturaRaw

    // Valida mime type
    if (!isMimeAceito(foto.type)) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Formato inválido. Use JPG, PNG ou WEBP." } },
        { status: 422 }
      )
    }

    // Valida tamanho
    if (foto.size > MAX_BYTES) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Imagem muito grande. Máximo 10MB." } },
        { status: 422 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Serviço indisponível." } },
        { status: 503 }
      )
    }

    const bytes = await foto.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mediaType = foto.type

    const anthropic = new Anthropic({ apiKey })

    const resposta = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: montarSystemPrompt(tipoCaptura),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extraia os dados do produto desta imagem seguindo exatamente o formato JSON instruído.",
            },
          ],
        },
      ],
    })

    const blocoTexto = resposta.content.find((bloco) => bloco.type === "text")
    if (!blocoTexto || blocoTexto.type !== "text") {
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível interpretar a resposta da extração." } },
        { status: 500 }
      )
    }

    const jsonLimpo = limparCercasMarkdown(blocoTexto.text)

    let resultado: { campos: CamposExtraidos; confianca: Record<string, CampoConfianca> }
    try {
      resultado = JSON.parse(jsonLimpo)
    } catch {
      return Response.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Não foi possível interpretar a resposta da extração." } },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: resultado,
    })
  } catch {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Falha ao processar a imagem. Tente novamente." } },
      { status: 500 }
    )
  }
}
