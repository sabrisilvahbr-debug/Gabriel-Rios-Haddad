/**
 * Modelos de mensagem. Variáveis: {empresa}, {link}, {agencia}, {cidade}, {ramo}.
 * Todo primeiro contato termina com a opção de responder SAIR.
 */
export const DEFAULT_FIRST_TEMPLATES: string[] = [
  'Oi, tudo bem? Aqui é {agencia}. Vi a {empresa} no Google Maps e reparei que vocês ainda não têm site. Montei uma prévia gratuita pra vocês darem uma olhada: {link}\n\nSe gostarem, eu coloco no ar com o endereço de vocês. Se não tiver interesse, é só responder SAIR que eu não mando mais mensagens.',
  'Olá! Aqui é {agencia}, eu faço sites para empresas de {cidade}. Preparei uma prévia de como poderia ficar o site da {empresa}, já com as informações que vocês têm no Google: {link}\n\nSe quiser, te explico como funciona. Se preferir não receber mensagens, é só responder SAIR.',
  'Oi! Aqui é {agencia}. Encontrei a {empresa} no Google e montei, sem compromisso, uma prévia de site pra vocês verem como ficaria: {link}\n\nSe curtirem, deixo no ar rapidinho. Se não tiver interesse, responda SAIR e eu não mando mais nada.',
];

export const DEFAULT_FOLLOW_UP =
  'Oi! Passando só pra saber se vocês conseguiram ver a prévia do site da {empresa}: {link}\n\nSe tiver alguma dúvida, é só me chamar. Se não tiver interesse, responda SAIR.';

export const OPT_OUT_CONFIRMATION =
  'Combinado! Não vou mais mandar mensagens. Desculpe o incômodo e boas vendas! 🙏';

export interface TemplateVars {
  empresa?: string;
  link?: string;
  agencia?: string;
  cidade?: string;
  ramo?: string;
}

/** Troca {empresa}, {link}, {agencia}, {cidade} e {ramo}; outras chaves ficam como estão. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{(empresa|link|agencia|cidade|ramo)\}/g, (match, key: keyof TemplateVars) => vars[key] ?? match)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Sorteia uma variação não vazia do modelo. */
export function pickTemplate(templates: string[], random: () => number = Math.random): string {
  const options = templates.map((t) => t.trim()).filter(Boolean);
  const list = options.length ? options : DEFAULT_FIRST_TEMPLATES;
  return list[Math.min(Math.floor(random() * list.length), list.length - 1)];
}
