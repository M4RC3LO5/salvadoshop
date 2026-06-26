"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Upload, X, AlertCircle, Loader2, ImagePlus, Pencil, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { EditorImagem } from "@/components/admin/EditorImagem"

interface ImagemUpload {
  id: string
  url: string
  public_id: string
  status: "ok"
}

interface ImagemPendente {
  id: string
  nome: string
  status: "enviando" | "erro"
  erro?: string
}

type ItemGaleria = ImagemUpload | ImagemPendente

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 10 * 1024 * 1024
const MAX_IMAGENS = 10

function isUpload(item: ItemGaleria): item is ImagemUpload {
  return item.status === "ok"
}

// ── Miniatura ordenável ──────────────────────────────────────────────────────

interface MiniaturaProps {
  item: ItemGaleria
  isPrincipal: boolean
  onEditar: (item: ImagemUpload) => void
  onRemover: (item: ItemGaleria) => void
}

function Miniatura({ item, isPrincipal, onEditar, onRemover }: MiniaturaProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isUpload(item) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square"
    >
      {item.status === "ok" ? (
        <>
          {/* Badge Principal */}
          {isPrincipal && (
            <span className="absolute left-1 top-1 z-10 rounded-sm bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow">
              Principal
            </span>
          )}

          {/* Drag handle */}
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
            className="absolute bottom-1 left-1 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/40 text-white opacity-0 transition group-hover/card:opacity-100 active:cursor-grabbing"
          >
            <GripVertical size={14} aria-hidden="true" />
          </button>

          {/* Miniatura clicável */}
          <button
            type="button"
            onClick={() => onEditar(item as ImagemUpload)}
            aria-label="Editar imagem"
            className="group/card relative h-full w-full overflow-hidden rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <Image
              src={(item as ImagemUpload).url}
              alt="Preview da imagem do produto"
              fill
              className="object-cover transition group-hover/card:brightness-75"
              sizes="(max-width: 640px) 33vw, 25vw"
            />
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/card:opacity-100">
              <Pencil size={18} className="text-white drop-shadow" aria-hidden="true" />
            </span>
          </button>

          {/* Botão remover */}
          <button
            type="button"
            onClick={() => onRemover(item)}
            aria-label="Remover imagem"
            className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </>
      ) : item.status === "enviando" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-stone-100">
          <Loader2 size={20} className="animate-spin text-amber-600" />
          <span className="text-center text-xs text-stone-400 leading-tight px-1">
            {(item as ImagemPendente).nome.slice(0, 16)}…
          </span>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 p-1">
          <AlertCircle size={18} className="shrink-0 text-red-400" />
          <p className="text-center text-xs text-red-600 leading-tight">
            {(item as ImagemPendente).erro}
          </p>
          <button
            type="button"
            onClick={() => onRemover(item)}
            className="text-xs text-red-500 underline"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  )
}

// ── Zona principal ───────────────────────────────────────────────────────────

interface ImageUploadZoneProps {
  onChange: (imagens: { url: string; public_id: string }[]) => void
}

export function ImageUploadZone({ onChange }: ImageUploadZoneProps) {
  const [galeria, setGaleria] = useState<ItemGaleria[]>([])
  const [dragAtivo, setDragAtivo] = useState(false)
  const [editando, setEditando] = useState<ImagemUpload | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const imagensOk = galeria.filter(isUpload)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  function notificar(lista: ItemGaleria[]) {
    onChange(
      lista
        .filter(isUpload)
        .map((i) => ({ url: i.url, public_id: i.public_id }))
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setGaleria((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      const nova = arrayMove(prev, oldIndex, newIndex)
      notificar(nova)
      return nova
    })
  }

  async function processarArquivos(files: FileList | File[]) {
    const novos = Array.from(files)
    const restantes = MAX_IMAGENS - imagensOk.length
    if (restantes <= 0) return
    const fila = novos.slice(0, restantes)

    const pendentes: ImagemPendente[] = fila.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      nome: f.name,
      status: "enviando",
    }))
    setGaleria((prev) => [...prev, ...pendentes])

    await Promise.all(
      fila.map(async (file, idx) => {
        const id = pendentes[idx].id

        const marcarErro = (erro: string) =>
          setGaleria((prev) =>
            prev.map((item): ItemGaleria =>
              item.id === id ? { id, nome: file.name, status: "erro", erro } : item
            )
          )

        if (!ALLOWED_TYPES.includes(file.type)) {
          marcarErro("Formato inválido. Use JPG, PNG ou WEBP.")
          return
        }
        if (file.size > MAX_BYTES) {
          marcarErro("Arquivo muito grande. Máximo 10MB.")
          return
        }

        try {
          const form = new FormData()
          form.append("arquivo", file)
          const res = await fetch("/api/admin/upload-imagem", { method: "POST", body: form })
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json?.error?.message ?? "Erro no upload.")

          const { url, public_id } = json.data
          setGaleria((prev) => {
            const nova = prev.map((item) =>
              item.id === id ? ({ id, url, public_id, status: "ok" } as ImagemUpload) : item
            )
            notificar(nova)
            return nova
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro no upload."
          setGaleria((prev) =>
            prev.map((item): ItemGaleria =>
              item.id === id ? { id, nome: file.name, status: "erro", erro: msg } : item
            )
          )
        }
      })
    )
  }

  async function remover(item: ItemGaleria) {
    setGaleria((prev) => {
      const nova = prev.filter((i) => i.id !== item.id)
      notificar(nova)
      return nova
    })
    if (isUpload(item)) {
      await fetch("/api/admin/deletar-imagem", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id }),
      })
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragAtivo(false)
      if (e.dataTransfer.files.length) processarArquivos(e.dataTransfer.files)
    },
    [galeria] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const total = galeria.length
  const cheio = imagensOk.length >= MAX_IMAGENS

  // Índice da primeira imagem com status "ok" (é a principal)
  const principalId = galeria.find(isUpload)?.id

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-600">Imagens do Produto</span>
        <span className="text-xs text-stone-400">{imagensOk.length}/{MAX_IMAGENS}</span>
      </div>

      {/* Área de drop */}
      {!cheio && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragAtivo(true) }}
          onDragLeave={() => setDragAtivo(false)}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Área de upload de imagens. Clique ou arraste arquivos."
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition
            ${dragAtivo
              ? "border-amber-500 bg-amber-50"
              : "border-stone-300 bg-stone-50 hover:border-amber-400 hover:bg-amber-50/40"
            }`}
        >
          <div className={`flex h-11 w-11 items-center justify-center rounded-full transition
            ${dragAtivo ? "bg-amber-100" : "bg-stone-200"}`}
          >
            {dragAtivo
              ? <ImagePlus className="h-5 w-5 text-amber-600" />
              : <Upload className="h-5 w-5 text-stone-400" />
            }
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">
              {dragAtivo ? "Solte para enviar" : "Clique ou arraste as imagens"}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              JPG, PNG ou WEBP · máx. 10MB · até {MAX_IMAGENS} fotos
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processarArquivos(e.target.files)}
          />
        </div>
      )}

      {/* Editor de imagem */}
      {editando && (
        <EditorImagem
          imagem={editando}
          onSalvar={(novaUrl) => {
            setGaleria((prev) => {
              const nova = prev.map((item) =>
                item.id === editando.id ? ({ ...editando, url: novaUrl } as ImagemUpload) : item
              )
              notificar(nova)
              return nova
            })
            setEditando(null)
          }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {/* Grade ordenável */}
      {total > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={galeria.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {galeria.map((item) => (
                <Miniatura
                  key={item.id}
                  item={item}
                  isPrincipal={item.id === principalId}
                  onEditar={setEditando}
                  onRemover={remover}
                />
              ))}

              {/* Botão "+" */}
              {!cheio && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  aria-label="Adicionar mais imagens"
                  className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-stone-400 transition hover:border-amber-400 hover:text-amber-600"
                >
                  <ImagePlus size={22} />
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {total > 0 && imagensOk.length > 1 && (
        <p className="text-xs text-stone-400">
          Arraste as imagens para reordenar · A primeira é a foto principal
        </p>
      )}
    </div>
  )
}
