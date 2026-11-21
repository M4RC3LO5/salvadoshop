import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin, erroValidacao, erroInterno } from "@/lib/supabase/admin-guard"
import { atualizarCompradorSchema } from "@/lib/validations/comprador"
import { buscarDuplicado, respostaDuplicado, validarSegmentos } from "@/lib/compradores/servidor"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  if (!z.string().uuid().safeParse(params.id).success) return erroValidacao("ID inválido.")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return erroValidacao("Body inválido.", 400)
  }

  const parsed = atualizarCompradorSchema.safeParse(body)
  if (!parsed.success) return erroValidacao(parsed.error.issues[0]?.message ?? "Dados inválidos.")
  const { segmentos, forcar, status, ...campos } = parsed.data
  const supabase = guard.supabase

  const { data: atual, error: erroAtual } = await supabase
    .from("compradores")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle()
  if (erroAtual) return erroInterno("comprador.atualizar.leitura.error", erroAtual, "Erro ao salvar o comprador.")
  if (!atual) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Comprador não encontrado." } },
      { status: 404 }
    )
  }

  // Descartado não muda de status por aqui. Origem e google_place_id nunca são tocados.
  const statusFinal = atual.status === "descartado" ? "descartado" : status
  if (statusFinal === "descartado" && atual.status !== "descartado") {
    return erroValidacao("Status inválido.")
  }

  const segs = await validarSegmentos(supabase, segmentos)
  if (!segs.ok) {
    return segs.erro
      ? erroInterno("comprador.atualizar.segmentos.error", null, "Erro ao salvar o comprador.")
      : erroValidacao("Segmento inválido.")
  }

  if (!forcar) {
    const dup = await buscarDuplicado(supabase, campos.telefone, campos.celular, params.id)
    if (dup.erro) return erroInterno("comprador.atualizar.duplicado.error", null, "Erro ao salvar o comprador.")
    if (dup.duplicado) return respostaDuplicado(dup.duplicado)
  }

  const { error } = await supabase
    .from("compradores")
    .update({ ...campos, status: statusFinal })
    .eq("id", params.id)
  if (error) return erroInterno("comprador.atualizar.error", error, "Erro ao salvar o comprador.")

  const { error: erroApagar } = await supabase.from("compradores_segmentos").delete().eq("comprador_id", params.id)
  if (erroApagar) return erroInterno("comprador.atualizar.segmentos.error", erroApagar, "Erro ao salvar o comprador.")

  if (segs.ids.length > 0) {
    const { error: erroSeg } = await supabase
      .from("compradores_segmentos")
      .insert(segs.ids.map((segmento_id) => ({ comprador_id: params.id, segmento_id })))
    if (erroSeg) return erroInterno("comprador.atualizar.segmentos.error", erroSeg, "Erro ao salvar o comprador.")
  }

  console.log(JSON.stringify({
    event: "comprador.atualizado",
    comprador_id: params.id,
    admin_id: guard.adminUser.id,
    timestamp: new Date().toISOString(),
  }))

  return Response.json({ success: true, data: { id: params.id } })
}
