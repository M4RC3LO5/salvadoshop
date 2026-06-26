"use client"

import { useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Sparkles,
  Check,
  PlusSquare,
  X,
  AlertTriangle,
} from "lucide-react"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  onChange: (html: string) => void
  initialContent?: string
  nome?: string
  specs?: string
}

type IaState =
  | { status: "idle" }
  | { status: "streaming"; partial: string }
  | { status: "done"; resultado: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_KEY = "ia_descricao_confirmado"

// Extrai texto puro do HTML para exibição segura no preview — sem dangerouslySetInnerHTML.
// O HTML completo só é inserido no documento via editor.commands.setContent() (ProseMirror).
function htmlParaTextoPreview(html: string): string {
  return html
    .replace(/```html?/gi, "")
    .replace(/```/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, disabled, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors
        disabled:cursor-not-allowed disabled:opacity-40
        ${active
          ? "bg-amber-700 text-white"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
    >
      {children}
    </button>
  )
}

// ─── Modal de confirmação de custo ────────────────────────────────────────────

interface ModalConfirmacaoIAProps {
  onConfirmar: () => void
  onCancelar: () => void
}

function ModalConfirmacaoIA({ onConfirmar, onCancelar }: ModalConfirmacaoIAProps) {
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false)

  function handleConfirmar() {
    if (naoMostrarNovamente) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1")
      } catch {
        // sessionStorage pode não estar disponível em alguns contextos
      }
    }
    onConfirmar()
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ia-titulo"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Sparkles size={18} className="text-amber-700" aria-hidden="true" />
          </div>
          <h2 id="modal-ia-titulo" className="text-base font-semibold text-stone-800">
            Gerar descrição com IA
          </h2>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-800">
              Cada geração tem um custo aproximado de{" "}
              <strong>R$&nbsp;0,05</strong>. Use com critério.
            </p>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={naoMostrarNovamente}
              onChange={(e) => setNaoMostrarNovamente(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-amber-700"
            />
            <span className="text-sm text-stone-600">
              Não mostrar novamente nesta sessão
            </span>
          </label>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            <Sparkles size={14} aria-hidden="true" />
            Entendi, gerar
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

export function RichTextEditor({
  onChange,
  initialContent = "",
  nome = "",
  specs = "",
}: RichTextEditorProps) {
  const [iaState, setIaState] = useState<IaState>({ status: "idle" })
  const [modalAberto, setModalAberto] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({
        placeholder: "Escreva a descrição comercial do produto...",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "min-h-[200px] px-3 py-2.5 text-sm text-stone-900 outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? "" : editor.getHTML())
    },
    immediatelyRender: false,
  })

  // ── Lógica do botão IA ──────────────────────────────────────────────────────

  function handleClicarBotaoIA() {
    let jaConfirmou = false
    try {
      jaConfirmou = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      // silencioso
    }

    if (jaConfirmou) {
      iniciarStreaming()
    } else {
      setModalAberto(true)
    }
  }

  function handleConfirmarModal() {
    setModalAberto(false)
    iniciarStreaming()
  }

  async function iniciarStreaming() {
    if (!editor) return

    const descricaoAtual = editor.isEmpty
      ? "Sem descrição ainda."
      : editor.getText()

    setIaState({ status: "streaming", partial: "" })

    try {
      const res = await fetch("/api/admin/melhorar-descricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome || "Produto sem nome",
          specs: specs || "Sem especificações.",
          descricaoAtual,
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? "Erro ao chamar IA.")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setIaState({ status: "streaming", partial: acumulado })
      }

      setIaState({ status: "done", resultado: acumulado })
    } catch (err) {
      console.error("[RichTextEditor] Erro IA:", err)
      setIaState({ status: "idle" })
      alert("Não foi possível gerar a descrição. Tente novamente.")
    }
  }

  // ── Ações pós-geração ───────────────────────────────────────────────────────

  function handleSubstituir() {
    if (iaState.status !== "done") return
    editor?.commands.setContent(iaState.resultado)
    onChange(iaState.resultado)
    setIaState({ status: "idle" })
  }

  function handleAdicionar() {
    if (iaState.status !== "done" || !editor) return
    editor.commands.insertContentAt(editor.state.doc.content.size, iaState.resultado)
    onChange(editor.isEmpty ? "" : editor.getHTML())
    setIaState({ status: "idle" })
  }

  function handleDescartar() {
    setIaState({ status: "idle" })
  }

  const isStreaming = iaState.status === "streaming"
  const isDone = iaState.status === "done"

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modal de confirmação */}
      {modalAberto && (
        <ModalConfirmacaoIA
          onConfirmar={handleConfirmarModal}
          onCancelar={() => setModalAberto(false)}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">
          Descrição Comercial{" "}
          <span className="text-red-500" aria-hidden="true">*</span>
        </label>

        <div className="overflow-hidden rounded-lg border border-stone-300 transition focus-within:border-amber-700 focus-within:ring-2 focus-within:ring-amber-700/20">

          {/* Toolbar de formatação */}
          <div
            role="toolbar"
            aria-label="Ferramentas de formatação de texto"
            className="flex flex-wrap items-center gap-0.5 border-b border-stone-200 bg-stone-50 px-2 py-1.5"
          >
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive("bold")}
              disabled={!editor?.can().chain().focus().toggleBold().run()}
              label="Negrito"
            >
              <Bold size={14} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive("italic")}
              disabled={!editor?.can().chain().focus().toggleItalic().run()}
              label="Itálico"
            >
              <Italic size={14} />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-stone-200" aria-hidden="true" />

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor?.isActive("heading", { level: 2 })}
              label="Título H2"
            >
              <Heading2 size={14} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor?.isActive("heading", { level: 3 })}
              label="Título H3"
            >
              <Heading3 size={14} />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-stone-200" aria-hidden="true" />

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive("bulletList")}
              label="Lista com marcadores"
            >
              <List size={14} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive("orderedList")}
              label="Lista numerada"
            >
              <ListOrdered size={14} />
            </ToolbarButton>
          </div>

          {/* Área de edição */}
          <EditorContent editor={editor} />

          {/* Painel de preview da IA */}
          {(isStreaming || isDone) && (
            <div className="border-t border-stone-200">
              {/* Cabeçalho do painel */}
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-2">
                <Sparkles
                  size={14}
                  className={`text-amber-600 ${isStreaming ? "animate-pulse" : ""}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-amber-700">
                  {isStreaming ? "IA escrevendo" : "Sugestão da IA pronta"}
                </span>
                {isStreaming && (
                  <span
                    className="inline-block h-3.5 w-0.5 animate-[blink_1s_step-end_infinite] bg-amber-600"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Texto gerado — exibido como texto puro, sem dangerouslySetInnerHTML.
                  O HTML só entra no editor via setContent() do Tiptap (ProseMirror). */}
              <pre
                className="whitespace-pre-wrap px-3 py-2.5 font-sans text-sm leading-relaxed text-stone-700"
                aria-live="polite"
                aria-label="Texto gerado pela IA"
              >
                {htmlParaTextoPreview(
                  isStreaming
                    ? (iaState as { status: "streaming"; partial: string }).partial
                    : (iaState as { status: "done"; resultado: string }).resultado
                )}
              </pre>

              {/* Botões de ação pós-geração */}
              {isDone && (
                <div className="flex flex-wrap gap-2 border-t border-stone-100 bg-stone-50 px-3 py-2">
                  <button
                    type="button"
                    onClick={handleSubstituir}
                    className="flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
                  >
                    <Check size={12} aria-hidden="true" />
                    Substituir texto
                  </button>
                  <button
                    type="button"
                    onClick={handleAdicionar}
                    className="flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                  >
                    <PlusSquare size={12} aria-hidden="true" />
                    Adicionar ao final
                  </button>
                  <button
                    type="button"
                    onClick={handleDescartar}
                    className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-50"
                  >
                    <X size={12} aria-hidden="true" />
                    Descartar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rodapé com botão IA */}
          <div className="flex justify-end border-t border-stone-100 bg-stone-50 px-3 py-2">
            <button
              type="button"
              onClick={handleClicarBotaoIA}
              disabled={isStreaming}
              aria-busy={isStreaming}
              className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles
                size={12}
                className={isStreaming ? "animate-pulse" : ""}
                aria-hidden="true"
              />
              {isStreaming ? "Gerando…" : "✨ Melhorar com IA"}
            </button>
          </div>

        </div>

        <p className="text-xs text-stone-400">
          Descrição exibida para o cliente na página do produto.
        </p>
      </div>
    </>
  )
}
