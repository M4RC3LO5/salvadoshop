import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  nome:          z.string().min(1, "Nome é obrigatório"),
  specs:         z.string().min(1, "Especificações são obrigatórias"),
  descricaoAtual: z.string().min(1, "Descrição atual é obrigatória"),
})

const SYSTEM_PROMPT = `Você é um redator especialista em e-commerce de produtos salvados. \
Escreva descrições comerciais persuasivas, honestas e que destacam o custo-benefício do produto. \
Use linguagem clara e direta. \
Retorne apenas o HTML da descrição, sem markdown, sem explicações.`

export async function POST(request: NextRequest) {
  // Verifica autenticação e role admin antes de qualquer processamento
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

  // Valida body com Zod
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
          message: "Dados inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    )
  }

  const { nome, specs, descricaoAtual } = parsed.data

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Serviço indisponível." } },
      { status: 503 }
    )
  }

  const anthropic = new Anthropic({ apiKey })

  const userPrompt = `Produto: ${nome}

Especificações técnicas:
${specs}

Rascunho atual da descrição:
${descricaoAtual}

Melhore a descrição comercial acima para este produto salvado. \
Destaque o valor, a economia e a oportunidade. \
Retorne apenas o HTML pronto para usar, sem nenhum texto extra.`

  // Cria o stream da Anthropic e repassa ao cliente
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(event.delta.text))
          }
        }
        controller.close()
      } catch {
        controller.error(new Error("Erro ao gerar descrição."))
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
