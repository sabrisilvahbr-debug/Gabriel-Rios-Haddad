/** Minúsculas, sem acentos e com espaços simples. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug para URLs: só letras, números e hífens, até 60 caracteres. */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Corta o texto no limite, de preferência no fim de uma palavra. */
export function truncate(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const atWord = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return atWord.replace(/[\s,;:–—-]+$/u, '');
}
