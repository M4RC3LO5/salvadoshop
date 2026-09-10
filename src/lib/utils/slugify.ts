// Slugify determinístico: minúsculo, sem acento, não-alfanumérico vira "-",
// sem hífen nas pontas. Mesma regra da função SQL public.slugify() (migration
// 023) — usada aqui no client (para decidir se o termo digitado já bate com
// uma categoria existente) e no servidor (checagem de duplicidade antes de
// inserir categoria nova).
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
