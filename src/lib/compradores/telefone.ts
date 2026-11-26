// Funções puras de telefone, usadas no cliente (máscara) e no servidor (validação).

export type TipoTelefone = "celular" | "telefone"

export const MSG_CELULAR = "Celular deve ter DDD + 9 dígitos. Ex.: (11) 91234-5678."
export const MSG_TELEFONE = "Telefone inválido. Ex.: (11) 2345-6789."

// Só dígitos; com 12 ou 13 dígitos começando por 55, remove o 55 (DDI do Brasil).
export function normalizarTelefone(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "")
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d.slice(2)
  return d
}

export function celularValido(valor: string | null | undefined): boolean {
  const d = normalizarTelefone(valor)
  return d.length === 11 && d[2] === "9"
}

export function telefoneValido(valor: string | null | undefined): boolean {
  const d = normalizarTelefone(valor)
  if (d.length === 10) return /^[2-5]$/.test(d[2])
  if (d.length === 11) return d[2] === "9" || d.startsWith("0800")
  if (d.length === 8) return /^[34]/.test(d)
  return false
}

// Aplica a máscara de forma progressiva (serve para o que está sendo digitado).
function mascarar(d: string, tipo: TipoTelefone): string {
  if (!d) return ""
  if (tipo === "telefone") {
    if (d.startsWith("0800")) {
      const partes = [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean)
      return partes.join(" ")
    }
    // Número nacional sem DDD: 8 dígitos começando por 3 ou 4 (ex.: 4004-1234).
    if (d.length <= 8 && /^[34]/.test(d)) {
      return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d
    }
  }
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  const corte = resto[0] === "9" ? 5 : 4
  const corpo = resto.length > corte ? `${resto.slice(0, corte)}-${resto.slice(corte)}` : resto
  return `(${ddd}) ${corpo}`
}

// Máscara enquanto digita. Limita a 11 dígitos; "+55" no começo é descartado.
export function mascararDigitando(valor: string, tipo: TipoTelefone): string {
  let d = valor.replace(/\D/g, "")
  if (valor.trim().startsWith("+55")) d = d.slice(2)
  return mascarar(d.slice(0, 11), tipo)
}

// Valor final já formatado, ou null se for inválido. Vazio também devolve null.
export function formatarTelefone(valor: string | null | undefined, tipo: TipoTelefone = "telefone"): string | null {
  const ok = tipo === "celular" ? celularValido(valor) : telefoneValido(valor)
  return ok ? mascarar(normalizarTelefone(valor), tipo) : null
}

// Para exibição: formata se der, senão mostra o texto como está.
export function exibirTelefone(valor: string | null | undefined): string {
  if (!valor) return ""
  return formatarTelefone(valor) ?? valor
}
