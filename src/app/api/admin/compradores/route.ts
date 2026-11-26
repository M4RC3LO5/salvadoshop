import { NextRequest } from "next/server"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"
import { criarCompradorSchema } from "@/lib/validations/comprador"
import { buscarDuplicado, respostaDuplicado, validarSegmentos } from "@/lib/compradores/servidor"

// Client com a sessão do usuário (RLS). criado_por e a empresa em CAIXA ALTA
// ficam por conta dos triggers do banco.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Body inválido.", 400)
  }

  const parsed = criarCompradorSchema.safeParse(body)
  if (!parsed.success) return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos.")
  const { segmentos, forcar, ...campos } = parsed.data
  const supabase = guard.supabase

  const segs = await validarSegmentos(supabase, segmentos)
  if (!segs.ok) {
    return segs.erro
      ? erroInterno("comprador.criar.segmentos.error", null, "Erro ao salvar o comprador.")
      : erroValidacao("Segmento inválido.")
  }

  if (!forcar) {
    const dup = await buscarDuplicado(supabase, campos.telefone, campos.celular)
    if (dup.erro) return erroInterno("comprador.criar.duplicado.error", null, "Erro ao salvar o comprador.")
    if (dup.duplicado) return respostaDuplicado(dup.duplicado)
  }

  const { data: criado, error } = await supabase.from("compradores").insert(campos).select("id").single()
  if (error || !criado) {
    return erroInterno("comprador.criar.error", error, "Erro ao salvar o comprador.")
  }

  if (segs.ids.length > 0) {
    const { error: erroSeg } = await supabase
      .from("compradores_segmentos")
      .insert(segs.ids.map((segmento_id) => ({ comprador_id: criado.id, segmento_id })))
    if (erroSeg) {
      // Não deixa comprador pela metade (Master apaga; Auxiliar não tem DELETE na RLS).
      await supabase.from("compradores").delete().eq("id", criado.id)
      return erroInterno("comprador.criar.segmentos.error", erroSeg, "Erro ao salvar o comprador.")
    }
  }

  console.log(JSON.stringify({
    event: "comprador.criado",
    comprador_id: criado.id,
    admin_id: guard.adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: criado.id } }, { status: 201 })
}
