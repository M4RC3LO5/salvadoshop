export const ROTULO_STATUS: Record<string, string> = {
  lead: "Lead",
  contato: "Contato",
  cliente: "Cliente",
  descartado: "Descartado",
}

export const ROTULO_ORIGEM: Record<string, string> = {
  carteira: "Carteira",
  google: "Google",
  indicacao: "Indicação",
  grupo_marketplace: "Grupo/Marketplace",
}

export const COR_STATUS: Record<string, string> = {
  lead: "bg-sky-100 text-sky-800",
  contato: "bg-amber-100 text-amber-800",
  cliente: "bg-emerald-100 text-emerald-800",
  descartado: "bg-stone-200 text-stone-600",
}

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function partes(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Object.fromEntries(FMT_DATA.formatToParts(d).map((x) => [x.type, x.value]))
}

export function formatarData(iso: string) {
  const p = partes(iso)
  return p ? `${p.day}/${p.month}/${p.year}` : iso
}

export function formatarDataHora(iso: string) {
  const p = partes(iso)
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : iso
}

export function soDigitos(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "")
}
