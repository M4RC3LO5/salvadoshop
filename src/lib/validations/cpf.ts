// Helpers de CPF compartilhados entre o checkout (cliente), a API e o admin.

export function somenteDigitosCpf(valor: string): string {
  return valor.replace(/\D/g, "")
}

export function validarCpf(valor: string): boolean {
  const d = somenteDigitosCpf(valor)
  if (d.length !== 11) return false
  // Rejeita sequências repetidas
  if (/^(\d)\1{10}$/.test(d)) return false

  const calc = (fator: number) => {
    let soma = 0
    for (let i = 0; i < fator - 1; i++) soma += parseInt(d[i]) * (fator - i)
    const resto = (soma * 10) % 11
    return resto >= 10 ? 0 : resto
  }
  return calc(10) === parseInt(d[9]) && calc(11) === parseInt(d[10])
}

// "12345678909" -> "123.456.789-09". Se não tiver 11 dígitos, devolve como veio.
export function formatarCpf(digitos: string): string {
  const d = somenteDigitosCpf(digitos)
  if (d.length !== 11) return digitos
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
