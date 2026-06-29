import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface OpcaoFrete {
  servico: string
  prazo: string
  preco: number
}

// ─── Zod schema ──────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  peso: z.number().positive().default(1),
  altura: z.number().positive().default(20),
  largura: z.number().positive().default(20),
  comprimento: z.number().positive().default(20),
  quantidade: z.number().int().positive().default(1),
})

const BodySchema = z.object({
  cep_destino: z
    .string()
    .regex(/^\d{8}$/, "CEP deve conter exatamente 8 dígitos numéricos"),
  itens: z.array(ItemSchema).min(1),
})

// ─── Tabela regional de fallback ─────────────────────────────────────────────
// Baseada no prefixo do CEP (2 dígitos) → zona de distância a partir de SP

function zonaParaCep(prefixo: number): 1 | 2 | 3 | 4 | 5 {
  if (prefixo <= 19) return 1                          // SP
  if (prefixo <= 28 || (prefixo >= 30 && prefixo <= 38)) return 2 // RJ/ES/MG/PR/SC/RS/DF/GO
  if (prefixo === 29) return 2
  if ((prefixo >= 70 && prefixo <= 76) || (prefixo >= 80 && prefixo <= 99)) return 2
  if (prefixo >= 39 && prefixo <= 49) return 3         // BA/SE/norte MG
  if (prefixo >= 50 && prefixo <= 58) return 3         // PE/AL
  if ((prefixo >= 77 && prefixo <= 79)) return 3       // TO/MT/MS
  if (prefixo >= 59 && prefixo <= 66) return 4         // RN/CE/PI
  if (prefixo >= 65 && prefixo <= 66) return 4         // MA
  if (prefixo >= 67 && prefixo <= 68) return 5         // PA
  if (prefixo === 69) return 5                         // AM/RR/AP
  return 3
}

interface InfoZona {
  pacPreco: number
  sedexPreco: number
  pacPrazo: string
  sedexPrazo: string
}

const ZONAS: Record<1 | 2 | 3 | 4 | 5, InfoZona> = {
  1: { pacPreco: 16.90,  sedexPreco: 25.90,  pacPrazo: "3 dias úteis",  sedexPrazo: "1 dia útil" },
  2: { pacPreco: 21.50,  sedexPreco: 34.90,  pacPrazo: "5 dias úteis",  sedexPrazo: "2 dias úteis" },
  3: { pacPreco: 26.80,  sedexPreco: 44.90,  pacPrazo: "7 dias úteis",  sedexPrazo: "3 dias úteis" },
  4: { pacPreco: 32.50,  sedexPreco: 57.90,  pacPrazo: "10 dias úteis", sedexPrazo: "4 dias úteis" },
  5: { pacPreco: 41.90,  sedexPreco: 72.90,  pacPrazo: "12 dias úteis", sedexPrazo: "5 dias úteis" },
}

function calcularFatorPeso(pesoTotalKg: number): number {
  // Acréscimo de 8% por kg adicional acima de 1kg
  const extra = Math.max(0, pesoTotalKg - 1)
  return 1 + extra * 0.08
}

function precoComPeso(base: number, fator: number): number {
  return Math.round(base * fator * 100) / 100
}

// ─── Correios API (tentativa) ─────────────────────────────────────────────────

async function consultarCorreios(
  cepOrigem: string,
  cepDestino: string,
  pesoKg: number,
  altura: number,
  largura: number,
  comprimento: number
): Promise<{ pac: { preco: number; prazo: number } | null; sedex: { preco: number; prazo: number } | null }> {
  const params = new URLSearchParams({
    nCdEmpresa: "",
    sDsSenha: "",
    sCepOrigem: cepOrigem.replace(/\D/g, ""),
    sCepDestino: cepDestino.replace(/\D/g, ""),
    nVlPeso: String(pesoKg),
    nCdFormato: "1",
    nVlComprimento: String(Math.max(comprimento, 16)),
    nVlAltura: String(Math.max(altura, 2)),
    nVlLargura: String(Math.max(largura, 11)),
    nVlDiametro: "0",
    sCdMaoPropria: "N",
    nVlValorDeclarado: "0",
    sCdAvisoRecebimento: "N",
    nCdServico: "04510,04014",
    StrRetorno: "xml",
    nIndicaCalculo: "3",
  })

  const url = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params}`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: "text/xml" },
  })

  if (!res.ok) return { pac: null, sedex: null }

  const xml = await res.text()

  function extrairServico(codigo: string) {
    // Extrai o bloco <cServico> do serviço pelo código
    const blocoRegex = new RegExp(
      `<cServico>[\\s\\S]*?<Codigo>${codigo}<\\/Codigo>[\\s\\S]*?<\\/cServico>`
    )
    const bloco = xml.match(blocoRegex)?.[0]
    if (!bloco) return null

    const erro = bloco.match(/<Erro>(\d+)<\/Erro>/)?.[1]
    if (erro && erro !== "0") return null

    const valorStr = bloco.match(/<Valor>([\d,]+)<\/Valor>/)?.[1]
    const prazoStr = bloco.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/)?.[1]

    if (!valorStr || !prazoStr) return null

    const preco = parseFloat(valorStr.replace(",", "."))
    const prazo = parseInt(prazoStr, 10)

    if (isNaN(preco) || isNaN(prazo)) return null
    return { preco, prazo }
  }

  return {
    pac: extrairServico("04510"),
    sedex: extrairServico("04014"),
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Corpo da requisição inválido" } },
      { status: 400 }
    )
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    const mensagem = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: mensagem } },
      { status: 400 }
    )
  }

  const { cep_destino, itens } = parsed.data

  // Validar existência do CEP via ViaCEP
  let cepValido = false
  try {
    const viaCep = await fetch(`https://viacep.com.br/ws/${cep_destino}/json/`, {
      signal: AbortSignal.timeout(5000),
    })
    if (viaCep.ok) {
      const dados = await viaCep.json() as { erro?: boolean }
      cepValido = !dados.erro
    }
  } catch {
    // Se ViaCEP falhar por timeout, assumimos CEP potencialmente válido e seguimos
    cepValido = true
  }

  if (!cepValido) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "CEP não encontrado. Verifique o número e tente novamente." } },
      { status: 404 }
    )
  }

  // Calcular totais de peso e dimensões
  const pesoTotal = itens.reduce((acc, i) => acc + i.peso * i.quantidade, 0)
  const alturaMax = Math.max(...itens.map((i) => i.altura))
  const larguraMax = Math.max(...itens.map((i) => i.largura))
  const comprimentoMax = Math.max(...itens.map((i) => i.comprimento))

  const cepOrigem = (process.env.NEXT_PUBLIC_CEP_ORIGEM ?? "01310100").replace(/\D/g, "")
  const enderecoLoja = process.env.NEXT_PUBLIC_ENDERECO_LOJA ?? "Consultar via WhatsApp"
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5511999999999"

  const opcoes: OpcaoFrete[] = []

  // Tentar Correios (best-effort)
  let usouCorreios = false
  try {
    const { pac, sedex } = await consultarCorreios(
      cepOrigem,
      cep_destino,
      pesoTotal,
      alturaMax,
      larguraMax,
      comprimentoMax
    )

    if (pac && sedex) {
      usouCorreios = true
      opcoes.push({
        servico: "PAC",
        prazo: `${pac.prazo} dia${pac.prazo === 1 ? " útil" : " dias úteis"}`,
        preco: pac.preco,
      })
      opcoes.push({
        servico: "SEDEX",
        prazo: `${sedex.prazo} dia${sedex.prazo === 1 ? " útil" : " dias úteis"}`,
        preco: sedex.preco,
      })
    }
  } catch {
    // Correios indisponível — fallback regional abaixo
  }

  // Fallback: tabela regional por zona
  if (!usouCorreios) {
    const prefixo = parseInt(cep_destino.slice(0, 2), 10)
    const zona = zonaParaCep(prefixo)
    const info = ZONAS[zona]
    const fator = calcularFatorPeso(pesoTotal)

    opcoes.push({
      servico: "PAC",
      prazo: info.pacPrazo,
      preco: precoComPeso(info.pacPreco, fator),
    })
    opcoes.push({
      servico: "SEDEX",
      prazo: info.sedexPrazo,
      preco: precoComPeso(info.sedexPreco, fator),
    })
  }

  // Sempre incluir retirada
  opcoes.push({
    servico: "Retirar na loja",
    prazo: `Combinar via WhatsApp — ${enderecoLoja}`,
    preco: 0,
  })

  return NextResponse.json({
    success: true,
    data: {
      opcoes,
      whatsapp,
      endereco_loja: enderecoLoja,
      fonte: usouCorreios ? "correios" : "tabela_regional",
    },
  })
}
