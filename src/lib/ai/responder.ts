import { generateJson, GeminiError } from './gemini';

export const REPLY_INTENTS = ['duvida', 'interessado', 'quer_humano', 'sem_interesse', 'outro'] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

export interface ReplyDecision {
  reply: string;
  intent: ReplyIntent;
  handoff: boolean;
}

export interface ReplyContext {
  agencyName: string;
  offerText: string;
  businessName: string;
  category: string;
  city: string;
  previewUrl: string;
  history: Array<{ from: 'nos' | 'empresa'; text: string }>;
}

const MAX_REPLY_CHARS = 600;

export function buildResponderSystemPrompt(ctx: ReplyContext): string {
  const agency = ctx.agencyName || 'a agência';
  const about = [ctx.category, ctx.city ? `em ${ctx.city}` : ''].filter(Boolean).join(' ');
  const offer = ctx.offerText.trim()
    ? ctx.offerText.trim()
    : `Nenhuma oferta cadastrada. Não informe preços, prazos nem condições; diga que ${agency} vai passar os valores.`;

  return [
    `Você é a assistente virtual de ${agency}, que cria sites para pequenas empresas.`,
    `Você conversa pelo WhatsApp com ${ctx.businessName}${about ? ` (${about})` : ''}.`,
    `${agency} montou uma prévia gratuita do site desta empresa: ${ctx.previewUrl}`,
    'Objetivo: tirar dúvidas, mostrar o valor de ter um site e descobrir se há interesse em colocar o site no ar.',
    '',
    'Regras:',
    '- Escreva em português do Brasil, em no máximo 3 frases curtas, com tom simpático e profissional, como numa conversa de WhatsApp. Sem listas e sem markdown.',
    '- Preços, prazos e condições: use somente as informações da oferta abaixo. Se a pergunta não estiver coberta, diga que ' +
      `${agency} vai passar os detalhes.`,
    '- Nunca invente descontos, prazos, garantias ou funcionalidades.',
    `- Se perguntarem se você é um robô ou uma pessoa, diga que é a assistente virtual de ${agency} e que ${agency} também acompanha a conversa.`,
    '- Não insista. Se a empresa disser que não tem interesse, agradeça com educação, encerre e use intent "sem_interesse".',
    `- Se a empresa quiser fechar, pedir para falar com uma pessoa, negociar preço ou marcar uma conversa, diga que ${agency} vai falar com ela em seguida e marque handoff como true.`,
    '',
    `Oferta de ${agency}:`,
    offer,
    '',
    'Responda em JSON com: reply (a mensagem), intent (duvida, interessado, quer_humano, sem_interesse ou outro) e handoff (true ou false).',
  ].join('\n');
}

function transcript(ctx: ReplyContext): string {
  const agency = ctx.agencyName || 'Agência';
  const lines = ctx.history.map((m) => `${m.from === 'nos' ? agency : ctx.businessName}: ${m.text}`);
  return ['Conversa até agora (da mais antiga para a mais recente):', ...lines, '', `Escreva a próxima resposta de ${agency}.`].join(
    '\n',
  );
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'A mensagem para enviar, no máximo 3 frases curtas.' },
    intent: { type: 'STRING', enum: [...REPLY_INTENTS] },
    handoff: { type: 'BOOLEAN' },
  },
  required: ['reply', 'intent', 'handoff'],
  propertyOrdering: ['reply', 'intent', 'handoff'],
};

export async function generateReply(ctx: ReplyContext): Promise<ReplyDecision> {
  const raw = (await generateJson({
    system: buildResponderSystemPrompt(ctx),
    prompt: transcript(ctx),
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.6,
  })) as Partial<Record<keyof ReplyDecision, unknown>> | null;

  const reply = typeof raw?.reply === 'string' ? raw.reply.trim().slice(0, MAX_REPLY_CHARS) : '';
  if (!reply) throw new GeminiError('A IA devolveu uma resposta vazia.');
  const intent = REPLY_INTENTS.find((i) => i === raw?.intent) ?? 'outro';
  return { reply, intent, handoff: raw?.handoff === true };
}
