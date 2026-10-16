import { NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-guard"
import { MAX_EXCLUSAO_EM_MASSA } from "@/lib/lista-venda/limites"

// Client do Supabase com a sessão do usuário (RLS) — sem service role.
// Os dados da lista de venda são lidos de estoque_itens aqui no servidor: o
// cliente envia apenas IDs, nunca valores. Custo, origem, fornecedor, estado,
// observações, lote e EAN nem sequer são selecionados (nunca vão para a lista).

const bodySchema = z.object({
  triagem_lista_id: z.string().uuid(),
  // IDs na ordem em que aparecem na tela — define a coluna "ordem".
  item_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um item.").max(1000),
})

// Exclusão em massa: uma requisição, lista de ids validada, limite por chamada.
const excluirSchema = z.object({
  ids: z.array(z.string().uuid("ID inválido.")).min(1, "Selecione ao menos uma lista.").max(
    MAX_EXCLUSAO_EM_MASSA,
    `Selecione no máximo ${MAX_EXCLUSAO_EM_MASSA} listas por vez.`
  ),
})

// "2028-04-15" -> "04/2028"
function validadeParaVencimento(validade: string | null): string | null {
  if (!validade) return null
  const m = /^(\d{4})-(\d{2})/.exec(validade)
  return m ? `${m[2]}/${m[1]}` : null
}

export async function POST(request: NextRequest) {
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
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }
  const { triagem_lista_id, item_ids } = parsed.data

  const { data: triagem } = await supabase
    .from("triagem_listas")
    .select("id, nome")
    .eq("id", triagem_lista_id)
    .single()

  if (!triagem) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Lista de triagem não encontrada." } },
      { status: 404 }
    )
  }

  // Somente as colunas que podem ir para a lista de venda.
  const { data: estoque, error: erroEstoque } = await supabase
    .from("estoque_itens")
    .select("id, nome, marca, sku, validade, num_caixas, qtd_embalagem")
    .eq("lista_id", triagem_lista_id)
    .in("id", item_ids)

  if (erroEstoque || !estoque) {
    console.error(JSON.stringify({ event: "listas_venda.gerar.estoque.error", error: erroEstoque }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao ler os itens da triagem." } },
      { status: 500 }
    )
  }

  const porId = new Map(estoque.map((i) => [i.id, i]))
  const ordenados = item_ids.map((id) => porId.get(id)).filter((i): i is NonNullable<typeof i> => !!i)
  if (ordenados.length === 0) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Nenhum dos itens foi encontrado nesta lista." } },
      { status: 404 }
    )
  }

  const { data: lista, error: erroLista } = await supabase
    .from("listas_venda")
    .insert({ triagem_lista_id, titulo: triagem.nome, criado_por: user.id })
    .select("id")
    .single()

  if (erroLista || !lista) {
    console.error(JSON.stringify({ event: "listas_venda.gerar.lista.error", error: erroLista }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao criar a lista de venda." } },
      { status: 500 }
    )
  }

  const { error: erroItens } = await supabase.from("listas_venda_itens").insert(
    ordenados.map((item, idx) => ({
      lista_venda_id: lista.id,
      estoque_item_id: item.id,
      ordem: idx + 1,
      descricao: item.nome,
      fabricante: item.marca,
      referencia: item.sku,
      vencimento: validadeParaVencimento(item.validade),
      qtd_caixas: Math.max(0, item.num_caixas),
      unid_por_caixa: Math.max(1, item.qtd_embalagem),
      preco_unitario: null,
    }))
  )

  if (erroItens) {
    console.error(JSON.stringify({ event: "listas_venda.gerar.itens.error", error: erroItens }))
    // Não deixa lista vazia para trás (itens saem em cascata).
    await supabase.from("listas_venda").delete().eq("id", lista.id)
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao copiar os itens para a lista de venda." } },
      { status: 500 }
    )
  }

  console.log(JSON.stringify({
    event: "listas_venda.gerada",
    lista_venda_id: lista.id,
    admin_id: adminUser.id,
    qtd_itens: ordenados.length,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: lista.id } }, { status: 201 })
}

// DELETE — exclui várias listas de uma vez (itens saem em cascata no banco)
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Body inválido." } },
      { status: 400 }
    )
  }

  const parsed = excluirSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Dados inválidos." } },
      { status: 422 }
    )
  }
  const ids = Array.from(new Set(parsed.data.ids))

  // A RLS (is_admin) continua valendo; .select() devolve só o que foi de fato apagado.
  const { data, error } = await guard.supabase.from("listas_venda").delete().in("id", ids).select("id")

  if (error) {
    console.error(JSON.stringify({ event: "listas_venda.excluir_massa.error", error }))
    return Response.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Erro ao excluir as listas." } },
      { status: 500 }
    )
  }

  console.log(JSON.stringify({
    event: "listas_venda.excluidas_em_massa",
    solicitadas: ids.length,
    excluidas: data?.length ?? 0,
    admin_id: guard.adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { ids: (data ?? []).map((r) => r.id) } })
}
