// Funções puras — podem ser usadas no servidor e no client.

// Sem acento, minúsculo, sem espaços nas pontas e com espaços internos colapsados.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

// Remove especificações repetidas (mesmo nome + mesmo valor, normalizados), mantendo a primeira.
export function removerEspecificacoesDuplicadas<T extends { nome: string; valor: string }>(itens: T[]): T[] {
  const vistos = new Set<string>()
  return itens.filter((item) => {
    const chave = `${normalizarTexto(item.nome)}\u0000${normalizarTexto(item.valor)}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}
