"use client"

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
} from "lucide-react"

interface RichTextEditorProps {
  onChange: (html: string) => void
  initialContent?: string
}

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
      className={`
        flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors
        disabled:cursor-not-allowed disabled:opacity-40
        ${active
          ? "bg-amber-700 text-white"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }
      `}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({ onChange, initialContent = "" }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
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

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-stone-700">
        Descrição Comercial{" "}
        <span className="text-red-500" aria-hidden="true">*</span>
      </label>

      <div className="overflow-hidden rounded-lg border border-stone-300 transition focus-within:border-amber-700 focus-within:ring-2 focus-within:ring-amber-700/20">
        {/* Toolbar */}
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
      </div>

      <p className="text-xs text-stone-400">
        Descrição exibida para o cliente na página do produto.
      </p>
    </div>
  )
}
