import Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { MODELO, calcularCustoUsd } from "./custo"
import { DadosAnuncioIa } from "./schema"
import { FERRAMENTA_RASCUNHO, montarSystemPrompt } from "./prompt"

// Só roda no servidor — não importar em componente client.

const CINCO_MINUTOS_MS = 5 * 60 * 1000
const MENSAGEM_ERRO = "A IA não conseguiu montar o rascunho. Tente de novo."

const imagensSchema = z.array(
  z.object({ url: z.string(), tipo: z.enum(["foto", "print_pedido"]) })
)

const LIMITE_NOME = 60

// Corta no último espaço que deixe até 60 caracteres (sem espaço, corte seco).
function encurtarNome(nome: string): string {
  const corte = nome.slice(0, LIMITE_NOME + 1)
  const ultimoEspaco = corte.lastIndexOf(" ", LIMITE_NOME)
  const base = ultimoEspaco > 0 ? nome.slice(0, ultimoEspaco) : nome.slice(0, LIMITE_NOME)
  return base.trim()
}

// Nomes de especificação que nunca podem ir para o produto público (comparados sem acento, minúsculos)
const NOMES_PROIBIDOS = ["anuncio de origem", "titulo do anuncio", "serial", "numero de serie", "lote", "cmiit"]

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function detalharErro(e: unknown): unknown {
  return e instanceof Error ? { name: e.name, message: e.message } : e
}

export class NaoProcessavelError extends Error {
  constructor() {
    super("NAO_PROCESSAVEL")
    this.name = "NaoProcessavelError"
  }
}

export async function processarAnuncio(
  supabase: SupabaseClient,
  id: string
): Promise<{ status: "pronto" | "erro" }> {
  // Passo 1 — trava atômica: só um processamento por vez (processando "velho" é retomável)
  const limite = new Date(Date.now() - CINCO_MINUTOS_MS).toISOString()
  const { data: travado, error: erroTrava } = await supabase
    .from("anuncios_ia")
    .update({ status: "processando", erro_mensagem: null })
    .eq("id", id)
    .or(`status.in.(enviado,erro),and(status.eq.processando,updated_at.lt."${limite}")`)
    .select("imagens")

  if (erroTrava) throw erroTrava
  if (!travado || travado.length === 0) throw new NaoProcessavelError()

  let tokensEntrada: number | null = null
  let tokensSaida: number | null = null

  try {
    const imagens = imagensSchema.parse(travado[0].imagens)

    // Passo 2 — categorias
    const { data: categorias, error: erroCat } = await supabase
      .from("categorias")
      .select("id, nome")
      .order("nome")
    if (erroCat) throw erroCat
    const lista = (categorias ?? []) as { id: string; nome: string }[]

    // Passo 3 — chamada à IA (imagens por URL, sem baixar no servidor)
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 50000,
      maxRetries: 0,
    })

    let nFoto = 0
    let nPrint = 0
    const conteudo: Anthropic.Messages.ContentBlockParam[] = []
    for (const img of imagens) {
      const rotulo =
        img.tipo === "foto" ? `Foto do produto ${++nFoto}` : `Print do pedido ${++nPrint}`
      conteudo.push({ type: "text", text: rotulo })
      conteudo.push({ type: "image", source: { type: "url", url: img.url } })
    }
    conteudo.push({ type: "text", text: "Monte o rascunho do anúncio seguindo as regras." })

    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: montarSystemPrompt(lista),
      tools: [FERRAMENTA_RASCUNHO],
      tool_choice: { type: "tool", name: "registrar_rascunho" },
      messages: [{ role: "user", content: conteudo }],
    })

    tokensEntrada = resposta.usage.input_tokens
    tokensSaida = resposta.usage.output_tokens

    // Passo 4 — valida a saída da IA antes de gravar
    const bloco = resposta.content.find((b) => b.type === "tool_use")
    if (!bloco || bloco.type !== "tool_use") throw new Error("Resposta sem tool_use.")

    const dados = DadosAnuncioIa.parse(bloco.input)
    if (dados.categoria_id && !lista.some((c) => c.id === dados.categoria_id)) {
      dados.categoria_id = null
    }
    if (dados.nome && dados.nome.length > LIMITE_NOME) {
      dados.nome = encurtarNome(dados.nome)
      dados.nao_confirmado.push("Título encurtado automaticamente; revise o nome.")
    }

    // Proteção em código: o anúncio é público, então tira das especificações
    // o que é do pedido ou identifica a unidade (mesmo se a IA ignorar o prompt).
    const tituloOrigem = normalizar(dados.pedido?.titulo_anuncio_origem ?? "")
    const antes = dados.especificacoes.length
    dados.especificacoes = dados.especificacoes.filter((e) => {
      const nomeNorm = normalizar(e.nome)
      if (NOMES_PROIBIDOS.some((t) => nomeNorm.includes(t))) return false
      if (tituloOrigem && normalizar(e.valor) === tituloOrigem) return false
      return true
    })
    const removidos = antes - dados.especificacoes.length
    if (removidos > 0) {
      console.log(JSON.stringify({ event: "anuncio_ia.especificacoes_filtradas", anuncio_id: id, removidos }))
    }

    // Passo 5 — sucesso
    const custo = calcularCustoUsd(tokensEntrada, tokensSaida)
    const { error: erroSalvar } = await supabase
      .from("anuncios_ia")
      .update({
        status: "pronto",
        dados_ia: dados,
        modelo: MODELO,
        tokens_entrada: tokensEntrada,
        tokens_saida: tokensSaida,
        custo_usd: custo,
      })
      .eq("id", id)
    if (erroSalvar) throw erroSalvar

    console.log(JSON.stringify({
      event: "anuncio_ia.processado",
      anuncio_id: id,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      custo_usd: custo,
      timestamp: new Date().toISOString(),
    }))
    return { status: "pronto" }
  } catch (error) {
    // Passo 6 — falha: mensagem simples no banco, detalhe só no console
    console.error(JSON.stringify({ event: "anuncio_ia.processar.error", anuncio_id: id, error: detalharErro(error) }))

    const patch: Record<string, unknown> = { status: "erro", erro_mensagem: MENSAGEM_ERRO }
    if (tokensEntrada !== null && tokensSaida !== null) {
      patch.modelo = MODELO
      patch.tokens_entrada = tokensEntrada
      patch.tokens_saida = tokensSaida
      patch.custo_usd = calcularCustoUsd(tokensEntrada, tokensSaida)
    }
    const { error: erroGravar } = await supabase.from("anuncios_ia").update(patch).eq("id", id)
    if (erroGravar) {
      console.error(JSON.stringify({ event: "anuncio_ia.processar.error", anuncio_id: id, error: detalharErro(erroGravar) }))
    }
    return { status: "erro" }
  }
}
