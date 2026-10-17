"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { redimensionarImagem } from "@/lib/utils/redimensionar-imagem"

type Tipo = "foto" | "print_pedido"

interface Item {
  key: string
  tipo: Tipo
  preview: string
  status: "enviando" | "ok" | "erro"
  url?: string
  public_id?: string
  erro?: string
}

const LIMITES: Record<Tipo, number> = { foto: 8, print_pedido: 2 }
const ACCEPT = "image/jpeg,image/png,image/webp"

async function apagarNoCloudinary(publicId: string) {
  try {
    await fetch("/api/admin/deletar-imagem", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id: publicId }),
    })
  } catch {
    // Falha ao limpar imagem temporária não deve travar a tela
  }
}

export default function NovoAnuncioIaPage() {
  const router = useRouter()
  const [itens, setItens] = useState<Item[]>([])
  const [erro, setErro] = useState("")
  const [enviando, setEnviando] = useState(false)
  const enviandoRef = useRef(false)
  const contador = useRef(0)

  const fotos = itens.filter((i) => i.tipo === "foto")
  const uploadEmAndamento = itens.some((i) => i.status === "enviando")
  const fotosOk = fotos.filter((i) => i.status === "ok").length
  const podeEnviar = fotosOk >= 1 && !uploadEmAndamento && !enviando

  function atualizar(key: string, patch: Partial<Item>) {
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  async function enviarArquivo(key: string, arquivo: File) {
    try {
      const reduzido = await redimensionarImagem(arquivo)
      const form = new FormData()
      form.append("arquivo", reduzido)
      const res = await fetch("/api/admin/anuncios-ia/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok || !json.success) {
        atualizar(key, { status: "erro", erro: json?.error?.message ?? "Falha no envio." })
        return
      }
      atualizar(key, { status: "ok", url: json.data.url, public_id: json.data.public_id })
    } catch (e) {
      atualizar(key, { status: "erro", erro: e instanceof Error ? e.message : "Falha no envio." })
    }
  }

  function aoEscolher(tipo: Tipo, lista: FileList | null, input: HTMLInputElement) {
    if (!lista) return
    setErro("")
    const atuais = itens.filter((i) => i.tipo === tipo).length
    const vagas = LIMITES[tipo] - atuais
    const arquivos = Array.from(lista)
    if (arquivos.length > vagas) {
      setErro(
        tipo === "foto"
          ? `Você pode enviar no máximo ${LIMITES.foto} fotos do produto.`
          : `Você pode enviar no máximo ${LIMITES.print_pedido} prints do pedido.`
      )
    }
    const aceitos = arquivos.slice(0, Math.max(vagas, 0))
    const novos: Item[] = aceitos.map((f) => ({
      key: `img-${contador.current++}`,
      tipo,
      preview: URL.createObjectURL(f),
      status: "enviando",
    }))
    setItens((prev) => [...prev, ...novos])
    novos.forEach((n, idx) => void enviarArquivo(n.key, aceitos[idx]))
    input.value = ""
  }

  async function remover(item: Item) {
    setItens((prev) => prev.filter((i) => i.key !== item.key))
    URL.revokeObjectURL(item.preview)
    if (item.public_id) await apagarNoCloudinary(item.public_id)
  }

  async function cancelar() {
    const enviados = itens.filter((i) => i.public_id)
    await Promise.all(enviados.map((i) => apagarNoCloudinary(i.public_id as string)))
    router.push("/admin/anuncios-ia")
  }

  async function enviarParaFila() {
    if (enviandoRef.current || !podeEnviar) return
    enviandoRef.current = true
    setEnviando(true)
    setErro("")
    try {
      const imagens = itens
        .filter((i) => i.status === "ok")
        .map((i) => ({ url: i.url, public_id: i.public_id, tipo: i.tipo }))
      const res = await fetch("/api/admin/anuncios-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagens }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErro(json?.error?.message ?? "Não foi possível enviar. Tente novamente.")
        enviandoRef.current = false
        setEnviando(false)
        return
      }
      router.push("/admin/anuncios-ia?enviado=1")
    } catch {
      setErro("Não foi possível enviar. Verifique a conexão e tente novamente.")
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  function Zona({ tipo, titulo, dica, obrigatoria }: { tipo: Tipo; titulo: string; dica?: string; obrigatoria?: boolean }) {
    const lista = itens.filter((i) => i.tipo === tipo)
    const id = `input-${tipo}`
    const cheio = lista.length >= LIMITES[tipo]
    return (
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label htmlFor={id} className="block text-base font-semibold text-gray-900">
            {titulo}
          </label>
          <p className="text-sm text-gray-600">
            {obrigatoria ? `De 1 a ${LIMITES[tipo]} fotos.` : `De 0 a ${LIMITES[tipo]} imagens.`}
            {dica ? ` ${dica}` : ""}
          </p>
        </div>

        <input
          id={id}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={cheio || enviando}
          onChange={(e) => aoEscolher(tipo, e.target.files, e.target)}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
        />

        {lista.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {lista.map((item) => (
              <li key={item.key} className="space-y-1">
                <div className="relative aspect-square overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={item.preview}
                    alt={tipo === "foto" ? "Foto do produto" : "Print do pedido"}
                    fill
                    sizes="120px"
                    unoptimized
                    className="object-cover"
                  />
                  {item.status === "enviando" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-label="Enviando" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void remover(item)}
                    disabled={enviando}
                    aria-label={`Remover ${tipo === "foto" ? "foto" : "print"}`}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {item.status === "ok" && <p className="text-xs text-green-700">Enviada</p>}
                {item.status === "erro" && (
                  <p role="alert" className="text-xs text-red-700">{item.erro ?? "Falha no envio."}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Novo anúncio por fotos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Envie fotos de um produto. A IA vai montar o rascunho do anúncio para você revisar depois.
        </p>
      </div>

      {Zona({ tipo: "foto", titulo: "Fotos do produto", obrigatoria: true })}
      {Zona({
        tipo: "print_pedido",
        titulo: "Print do pedido (opcional)",
        dica: "Ex.: print da tela do pedido no AliExpress.",
      })}

      {erro && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void enviarParaFila()}
          disabled={!podeEnviar}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {enviando ? "Enviando..." : "Enviar para a fila"}
        </button>
        <button
          type="button"
          onClick={() => void cancelar()}
          disabled={enviando}
          className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
