import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { COR_CABECALHO } from "@/lib/lista-venda/empresa"
import { normalizarLarguras } from "@/lib/lista-venda/larguras"
import { ImpressaoListaVenda } from "./ImpressaoListaVenda"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ImprimirListaVendaPage({ params }: { params: { id: string } }) {
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

  const { data } = await supabase
    .from("listas_venda_itens")
    .select("id, descricao, fabricante, referencia, vencimento, qtd_caixas, unid_por_caixa, preco_unitario")
    .eq("lista_venda_id", params.id)
    .order("ordem", { ascending: true })

  const itens = (data ?? []).map((i) => ({
    ...i,
    preco_unitario: i.preco_unitario === null ? null : Number(i.preco_unitario),
  }))

  return (
    <div className="lista-impressao">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
        }
        .lista-impressao { font-family: Calibri, Carlito, Arial, sans-serif; color: #000; }
        .folha { background: #fff; width: 210mm; max-width: 100%; margin: 0 auto; padding: 8mm; box-sizing: border-box; display: flex; flex-direction: column; min-height: 297mm; }
        @media print { .folha { width: auto; padding: 0; margin: 0; min-height: 279mm; } }
        .folha table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
        .folha thead { display: table-header-group; }
        .folha tr { break-inside: avoid; page-break-inside: avoid; }
        .folha th, .folha td { border: 1px solid #000; padding: 0.9mm 0.9mm; }
        .folha th { white-space: nowrap; position: relative; }
        .alca { position: absolute; top: 0; right: -5px; width: 10px; height: 100%; cursor: col-resize; z-index: 2; touch-action: none; user-select: none; }
        .alca::after { content: ""; position: absolute; left: 4px; top: 20%; height: 60%; width: 2px; border-radius: 1px; background: rgba(0,0,0,.28); }
        .alca:hover::after, .alca:focus-visible::after { background: #b45309; width: 3px; left: 3.5px; }
        .alca:focus-visible { outline: none; }
        @media print { .alca { display: none !important; } }
        .folha td { overflow: hidden; word-break: break-word; }
        .folha td.num { white-space: nowrap; }
        .folha td.apertada { font-size: 8pt; }
        .folha td.fab { font-size: 8.5pt; }
        .folha td { border-top-color: #9a9a9a; border-bottom-color: #9a9a9a; vertical-align: bottom; height: 4.9mm; overflow-wrap: anywhere; }
        .folha th { background: #${COR_CABECALHO}; font-family: "Arial Black", Arial, sans-serif; font-weight: 900; font-size: 9pt; text-align: center; }
        .folha th.titulo { text-decoration: underline; border-bottom: 1px solid #000; }
        .folha td.centro { text-align: center; }
        .folha td.direita { text-align: left; }
        .folha td.longa { font-size: 7.5pt; }
        .total-geral { text-align: right; font-weight: 700; font-size: 10.2pt; margin-top: 1mm; padding-right: 1mm; }
        .aviso { text-align: center; font-family: Arial, sans-serif; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 11.2pt; margin-top: 7mm; white-space: pre-line; }
        .rodape-empresa { margin-top: auto; padding-top: 8mm; text-align: center; font-family: Arial, sans-serif; font-size: 9.4pt; }
      `}</style>

      <ImpressaoListaVenda
        listaId={lista.id}
        titulo={lista.titulo}
        rodape={lista.rodape}
        itens={itens}
        largurasIniciais={normalizarLarguras(lista.larguras_colunas)}
      />
    </div>
  )
}
