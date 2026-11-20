import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompradorForm } from "../CompradorForm"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditarCompradorPage({ params }: { params: { id: string } }) {
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

  if (!UUID.test(params.id)) notFound()

  const [compradorRes, segmentosRes] = await Promise.all([
    supabase
      .from("compradores")
      .select("*, segs:compradores_segmentos(segmento_id)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("segmentos").select("id, nome").eq("ativo", true).order("ordem", { ascending: true }),
  ])

  const c = compradorRes.data
  if (!c) notFound()

  return (
    <CompradorForm
      id={c.id}
      criadoEm={c.created_at}
      segmentos={segmentosRes.data ?? []}
      inicial={{
        empresa: c.empresa ?? "",
        pessoa_contato: c.pessoa_contato ?? "",
        telefone: c.telefone ?? "",
        celular: c.celular ?? "",
        celular_whatsapp: !!c.celular_whatsapp,
        email: c.email ?? "",
        endereco: c.endereco ?? "",
        bairro: c.bairro ?? "",
        cidade: c.cidade ?? "",
        uf: c.uf ?? "",
        site: c.site ?? "",
        segmentos: (c.segs as { segmento_id: number }[]).map((x) => x.segmento_id),
        origem: c.origem,
        status: c.status,
        observacao: c.observacao ?? "",
      }}
    />
  )
}
