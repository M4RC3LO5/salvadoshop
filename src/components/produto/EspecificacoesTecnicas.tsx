// Seção pública de especificações (produto e lote).
// O admin grava specs_tecnicas como { texto: "..." } — texto livre, exibido
// como está, preservando quebras de linha. Objetos em outro formato caem no
// modo antigo de pares chave/valor, por compatibilidade.

type ConteudoSpecs =
  | { modo: "texto"; texto: string }
  | { modo: "pares"; pares: { chave: string; label: string; valor: string }[] }

function formatarLabel(chave: string) {
  return chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

function valorParaTexto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim()
  if (typeof valor === "number") return String(valor)
  if (Array.isArray(valor)) {
    return valor
      .filter((v) => typeof v === "string" || typeof v === "number")
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(", ")
  }
  return ""
}

function normalizarSpecs(specs: unknown): ConteudoSpecs | null {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null

  const obj = specs as Record<string, unknown>

  if (typeof obj.texto === "string" && obj.texto.trim()) {
    return { modo: "texto", texto: obj.texto.trim() }
  }

  const pares = Object.entries(obj)
    .map(([chave, valor]) => ({ chave, label: formatarLabel(chave), valor: valorParaTexto(valor) }))
    .filter((p) => p.valor)

  return pares.length > 0 ? { modo: "pares", pares } : null
}

export function EspecificacoesTecnicas(
  { titulo, specs }: { titulo: string; specs: unknown }
) {
  const conteudo = normalizarSpecs(specs)
  if (!conteudo) return null

  return (
    <div className="border-t border-zinc-100 pt-6">
      <h2 className="text-base font-semibold text-marrom-800 mb-3">{titulo}</h2>
      {conteudo.modo === "texto" ? (
        <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line break-words">
          {conteudo.texto}
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-1.5">
          {conteudo.pares.map(({ chave, label, valor }) => (
            <div key={chave} className="flex gap-3 py-1.5 border-b border-zinc-50 last:border-0">
              <dt className="text-xs font-semibold text-zinc-500 w-32 shrink-0">{label}</dt>
              <dd className="text-xs text-zinc-700">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
