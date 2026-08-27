import { Loader2 } from "lucide-react"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

interface LoadingSpinnerProps {
  label?: string
  size?: number
  className?: string
}

// Indicador de carregamento padrão do admin — usado em loading.tsx de rotas
// e no carregamento inicial de telas client-side (ver CLAUDE.md item 15).
export function LoadingSpinner({ label = "Carregando...", size = 32, className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={cn("flex items-center justify-center gap-2 py-20 text-sm text-stone-400", className)}
    >
      <Loader2 className="animate-spin text-amber-700" size={size} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
