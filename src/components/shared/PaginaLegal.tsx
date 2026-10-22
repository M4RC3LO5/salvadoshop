// Moldura comum das páginas legais (container e tipografia).
export function PaginaLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string
  atualizadoEm?: string
  children: React.ReactNode
}) {
  return (
    <div className="container py-8 sm:py-12 px-4 max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-marrom-800">{titulo}</h1>
      {atualizadoEm && (
        <p className="mt-2 text-sm text-marrom-500">Última atualização: {atualizadoEm}</p>
      )}
      <div className="mt-6 flex flex-col gap-4 text-sm sm:text-base leading-relaxed text-marrom-700 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-marrom-800 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:text-ambar-700 [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  )
}
