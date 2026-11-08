import { normalizeText } from '@/lib/text';

function clean(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mensagens que, sozinhas, significam "não quero receber". */
const EXACT_OPT_OUT = new Set([
  'sair',
  'parar',
  'pare',
  'para',
  'stop',
  'cancelar',
  'remover',
  'descadastrar',
  'nao',
  'nao obrigado',
  'nao obrigada',
  'nao quero',
  'nao quero obrigado',
  'nao quero obrigada',
  'sem interesse',
  'nao tenho interesse',
]);

/** Trechos que indicam pedido para parar, em qualquer lugar da mensagem. */
const OPT_OUT_PHRASES = [
  'nao tenho interesse',
  'nao temos interesse',
  'sem interesse',
  'pare de mandar',
  'para de mandar',
  'parem de mandar',
  'nao me mande',
  'nao mande mais',
  'nao manda mais',
  'me tira',
  'me tire',
  'me remove',
  'me remova',
  'remover meu numero',
  'remova meu numero',
  'descadastr',
  'nao quero receber',
  'nao quero mais',
  'nao precisamos',
  'nao preciso de site',
  'nao me interessa',
];

export function isOptOut(text: string): boolean {
  const value = clean(text);
  if (!value) return false;
  if (EXACT_OPT_OUT.has(value)) return true;
  return OPT_OUT_PHRASES.some((phrase) => value.includes(phrase));
}

const AUTO_REPLY_PHRASES = [
  'mensagem automatica',
  'resposta automatica',
  'obrigado pelo contato',
  'obrigada pelo contato',
  'agradecemos o contato',
  'agradecemos seu contato',
  'em breve retornaremos',
  'retornaremos em breve',
  'em breve responderemos',
  'responderemos em breve',
  'horario de atendimento',
  'no momento nao podemos',
  'assim que possivel',
  'seja bem vindo',
  'seja bem vinda',
  'como podemos ajudar',
  'em que podemos ajudar',
  'fora do horario',
];

/** Saudação automática do WhatsApp Business da empresa (não é uma resposta de verdade). */
export function looksLikeAutoReply(text: string): boolean {
  const value = clean(text);
  return AUTO_REPLY_PHRASES.some((phrase) => value.includes(phrase));
}
