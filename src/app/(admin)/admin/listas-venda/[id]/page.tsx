import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { normalizarLarguras } from "@/lib/lista-venda/larguras"
import { FOLHA_CSS } from "@/lib/lista-venda/folha-css"
import { normalizarFormatacao } from "@/lib/lista-venda/formatacao"
import { EditorListaVenda, type ItemVenda } from "./EditorListaVenda"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ListaVendaPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()

  if (!adminUser) redirect("/")

  const { data: lista } = await supabase
    .from("listas_venda")
    .select("id, titulo, rodape, larguras_colunas")
    .eq("id", params.id)
    .maybeSingle()

  if (!lista) notFound()

  const { data: itensData, error } = await supabase
    .from("listas_venda_itens")
    .select("id, ordem, descricao, fabricante, referencia, vencimento, qtd_caixas, unid_por_caixa, preco_unitario, formatacao")
    .eq("lista_venda_id", params.id)
    .order("ordem", { ascending: true })

  if (error) {
    console.error(JSON.stringify({ event: "listas_venda.get.itens.error", error }))
  }

  const itens: ItemVenda[] = (itensData ?? []).map((i) => ({
    ...i,
    preco_unitario: i.preco_unitario === null ? null : Number(i.preco_unitario),
    formatacao: normalizarFormatacao(i.formatacao),
  }))

  return (
    <>
      {/* Estilo da folha no servidor: texto com aspas dentro de <style> num componente cliente quebra a hidratação */}
      <style>{FOLHA_CSS}</style>
      <EditorListaVenda listaId={lista.id} tituloInicial={lista.titulo} rodapeInicial={lista.rodape} itensIniciais={itens} larguras={normalizarLarguras(lista.larguras_colunas)} />
    </>
  )
}
