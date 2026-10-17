import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Camera, ImageOff } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { BotaoProcessar } from "./BotaoProcessar"

// Painel admin nunca usa cache — dados sempre frescos (CLAUDE.md item 9).
export const dynamic = "force-dynamic"

const STATUS_ROTULO: Record<string, { label: string; cls: string }> = {
  enviado:     { label: "Na fila",              cls: "bg-gray-100 text-gray-700" },
  processando: { label: "Processando",          cls: "bg-blue-100 text-blue-800" },
  pronto:      { label: "Pronto para revisar",  cls: "bg-green-100 text-green-800" },
  erro:        { label: "Erro",                 cls: "bg-red-100 text-red-800" },
  convertido:  { label: "Virou produto",        cls: "bg-purple-100 text-purple-800" },
}

interface ImagemAnuncio {
  url?: string
  tipo?: string
}

function formatCusto(valor: number) {
  return `US$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function AnunciosIaPage({
  searchParams,
}: {
  searchParams: { enviado?: string }
}) {
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

  const { data, error } = await supabase
    .from("anuncios_ia")
    .select("id, status, imagens, created_at, dados_ia, erro_mensagem, custo_usd")
    .neq("status", "descartado")
    .order("created_at", { ascending: false })

  if (error) {
    console.error(JSON.stringify({ event: "anuncios_ia.list.error", error }))
  }

  const anuncios = (data ?? []).map((a) => {
    const imagens = (Array.isArray(a.imagens) ? a.imagens : []) as ImagemAnuncio[]
    const fotos = imagens.filter((i) => i.tipo === "foto")
    return {
      id: a.id as string,
      status: a.status as string,
      created_at: a.created_at as string,
      qtdFotos: fotos.length,
      miniatura: fotos[0]?.url ?? null,
      nome: ((a.dados_ia as { nome?: string | null } | null)?.nome ?? null) as string | null,
      erroMensagem: (a.erro_mensagem ?? null) as string | null,
      custo: a.custo_usd === null || a.custo_usd === undefined ? null : Number(a.custo_usd),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Anúncio por fotos</h1>
        <Link
          href="/admin/anuncios-ia/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Novo anúncio por fotos
        </Link>
      </div>

      {searchParams.enviado === "1" && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Fotos enviadas! O anúncio entrou na fila.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Não foi possível carregar a fila. Tente recarregar a página.
        </div>
      )}

      {!error && anuncios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
          Nenhum anúncio na fila. Envie as fotos de um produto para começar.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {anuncios.map((a) => {
            const st = STATUS_ROTULO[a.status] ?? { label: a.status, cls: "bg-gray-100 text-gray-700" }
            return (
              <li key={a.id} className="flex items-center gap-4 p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {a.miniatura ? (
                    <Image
                      src={a.miniatura}
                      alt="Primeira foto do anúncio"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <ImageOff className="m-auto h-6 w-6 text-gray-400" aria-label="Sem foto" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{formatDataHora(a.created_at)}</p>
                  <p className="text-sm text-gray-600">
                    {a.qtdFotos} {a.qtdFotos === 1 ? "foto" : "fotos"}
                  </p>
                  {a.status === "pronto" && (
                    <>
                      <p className="truncate text-sm text-gray-800">{a.nome ?? "Sem nome identificado"}</p>
                      {a.custo !== null && (
                        <p className="text-xs text-gray-500">Custo IA: {formatCusto(a.custo)}</p>
                      )}
                    </>
                  )}
                  {a.status === "erro" && a.erroMensagem && (
                    <p className="text-sm text-red-700">{a.erroMensagem}</p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                {(a.status === "enviado" || a.status === "erro") && (
                  <BotaoProcessar id={a.id} status={a.status} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
