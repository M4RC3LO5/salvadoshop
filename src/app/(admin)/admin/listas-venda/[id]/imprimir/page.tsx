import { notFound, redirect } from "next/navigation"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A impressão agora é a própria tela de edição (a folha A4 editável).
// Links antigos continuam funcionando.
export default function ImprimirListaVendaPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()
  redirect(`/admin/listas-venda/${params.id}`)
}
