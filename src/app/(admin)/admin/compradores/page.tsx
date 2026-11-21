import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompradoresClientUI, type CompradorRow, type SegmentoOpcao } from "./CompradoresClientUI"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const LIMITE_BUSCAS_MES = 1000

export default async function CompradoresPage({ searchParams }: { searchParams: { salvo?: string } }) {
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

  const [compradoresRes, segmentosRes, buscasRes] = await Promise.all([
    supabase
      .from("compradores")
      .select(
        "id, empresa, telefone, celular, celular_whatsapp, bairro, cidade, uf, status, origem, created_at, segs:compradores_segmentos(segmento_id)"
      )
      .order("empresa", { ascending: true })
      .limit(5000),
    supabase.from("segmentos").select("id, nome").eq("ativo", true).order("ordem", { ascending: true }),
    supabase.rpc("google_buscas_no_mes"),
  ])

  if (compradoresRes.error) {
    console.error(JSON.stringify({ event: "compradores.list.error", error: compradoresRes.error }))
  }

  const segmentos: SegmentoOpcao[] = segmentosRes.data ?? []
  const nomePorId = new Map(segmentos.map((s) => [s.id, s.nome]))

  const compradores: CompradorRow[] = (compradoresRes.data ?? []).map((c) => {
    const segIds = (c.segs as { segmento_id: number }[]).map((x) => x.segmento_id)
    return {
      id: c.id,
      empresa: c.empresa,
      telefone: c.telefone,
      celular: c.celular,
      celular_whatsapp: c.celular_whatsapp,
      bairro: c.bairro,
      cidade: c.cidade,
      uf: c.uf,
      status: c.status,
      origem: c.origem,
      created_at: c.created_at,
      segmento_ids: segIds,
      segmentos_nomes: segmentos.filter((s) => segIds.includes(s.id)).map((s) => nomePorId.get(s.id) as string),
    }
  })

  const usadas = typeof buscasRes.data === "number" ? buscasRes.data : 0
  const restantes = Math.max(0, LIMITE_BUSCAS_MES - usadas)
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .toLowerCase()

  return (
    <CompradoresClientUI
      compradores={compradores}
      segmentos={segmentos}
      buscasRestantes={restantes}
      mes={mes}
      erroCarregar={!!compradoresRes.error}
      salvo={searchParams.salvo === "1"}
    />
  )
}
