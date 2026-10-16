import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { precoCaixa, totalGeral, totalItem } from "@/lib/utils/lista-venda"
import { COR_CABECALHO, EMPRESA, LIMITE_DESCRICAO_LONGA } from "@/lib/lista-venda/empresa"
import { BotoesImpressao } from "./BotoesImpressao"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

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
    .select("id, titulo, rodape")
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
  const geral = totalGeral(itens)

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
        .folha table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.5pt; }
        .folha thead { display: table-header-group; }
        .folha tr { break-inside: avoid; page-break-inside: avoid; }
        .folha th, .folha td { border: 1px solid #000; padding: 1.2mm 0.9mm; }
        .folha th, .folha td:not(:first-child) { white-space: nowrap; overflow-wrap: normal; }
        .folha td { border-top-color: #9a9a9a; border-bottom-color: #9a9a9a; vertical-align: bottom; height: 7.4mm; overflow-wrap: anywhere; }
        .folha th { background: #${COR_CABECALHO}; font-family: "Arial Black", Arial, sans-serif; font-weight: 900; font-size: 9pt; text-align: center; }
        .folha th.titulo { text-decoration: underline; border-bottom: 1px solid #000; }
        .folha td.centro { text-align: center; }
        .folha td.direita { text-align: left; }
        .folha td.longa { font-size: 7.5pt; }
        .total-geral { text-align: right; font-weight: 700; font-size: 10.2pt; margin-top: 1mm; padding-right: 1mm; }
        .aviso { text-align: center; font-family: Arial, sans-serif; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 11.2pt; margin-top: 7mm; white-space: pre-line; }
        .rodape-empresa { margin-top: auto; padding-top: 8mm; text-align: center; font-family: Arial, sans-serif; font-size: 9.4pt; }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <BotoesImpressao voltarHref={`/admin/listas-venda/${lista.id}`} />
      </div>

      <div className="folha shadow print:shadow-none">
        <div className="mb-[9mm]">
          <Image
            src={EMPRESA.logoPublicPath}
            alt="Comercial Dantas de Salvados e Sinistros — compra e venda por atacado, desde 2004"
            width={EMPRESA.logoLargura}
            height={EMPRESA.logoAltura}
            unoptimized
            priority
            style={{ width: "100mm", height: "auto" }}
          />
        </div>

        <table>
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "10.5%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9.2%" }} />
            <col style={{ width: "8.5%" }} />
            <col style={{ width: "8.8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr><th colSpan={8} className="titulo">{lista.titulo}</th></tr>
            <tr>
              <th scope="col">Descrição</th>
              <th scope="col">Fabr.</th>
              <th scope="col">Ref.</th>
              <th scope="col">Vencto</th>
              <th scope="col">Qtd</th>
              <th scope="col">R$ UND</th>
              <th scope="col">R$ Cx</th>
              <th scope="col">R$ Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const cx = precoCaixa(i)
              const total = totalItem(i)
              return (
                <tr key={i.id}>
                  <td className={i.descricao.length > LIMITE_DESCRICAO_LONGA ? "longa" : undefined}>{i.descricao}</td>
                  <td className="centro">{i.fabricante}</td>
                  <td className="centro">{i.referencia}</td>
                  <td className="centro">{i.vencimento}</td>
                  <td className="centro">{i.qtd_caixas} &nbsp;x&nbsp; {i.unid_por_caixa}</td>
                  <td className="direita">{i.preco_unitario === null ? "" : BRL.format(i.preco_unitario)}</td>
                  <td className="direita">{cx === null ? "" : BRL.format(cx)}</td>
                  <td className="direita">{total === null ? "" : BRL.format(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="total-geral">{BRL.format(geral)}</div>

        <p className="aviso">{lista.rodape}</p>

        <div className="rodape-empresa">
          {EMPRESA.linhasRodape.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
