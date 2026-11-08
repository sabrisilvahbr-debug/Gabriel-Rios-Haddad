/** Leitura dos webhooks da Evolution API v2, que mudam um pouco entre versões. */

export type EvolutionEvent =
  | { type: 'connection'; state: string }
  | { type: 'qrcode'; base64: string | null }
  | {
      type: 'message';
      id: string;
      fromMe: boolean;
      phoneDigits: string | null;
      text: string;
      isGroup: boolean;
      timestamp: Date;
    }
  | { type: 'ignored' };

type Dict = Record<string, unknown>;
const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

function eventName(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/_/g, '.') : '';
}

function digitsFromJid(jid: string | undefined): string | null {
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return null;
  const digits = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  return digits || null;
}

function messageText(message: unknown): string {
  if (!isDict(message)) return '[mensagem]';
  const nested = (key: string, field: string) => (isDict(message[key]) ? str((message[key] as Dict)[field]) : undefined);
  return (
    str(message.conversation) ??
    nested('extendedTextMessage', 'text') ??
    nested('imageMessage', 'caption') ??
    nested('videoMessage', 'caption') ??
    nested('documentMessage', 'caption') ??
    nested('buttonsResponseMessage', 'selectedDisplayText') ??
    nested('templateButtonReplyMessage', 'selectedDisplayText') ??
    nested('listResponseMessage', 'title') ??
    (isDict(message.imageMessage) ? '[imagem]' : undefined) ??
    (isDict(message.audioMessage) ? '[áudio]' : undefined) ??
    (isDict(message.videoMessage) ? '[vídeo]' : undefined) ??
    (isDict(message.stickerMessage) ? '[figurinha]' : undefined) ??
    (isDict(message.documentMessage) ? '[documento]' : undefined) ??
    '[mensagem]'
  );
}

function timestamp(value: unknown): Date {
  let seconds: number | undefined;
  if (typeof value === 'number') seconds = value;
  else if (typeof value === 'string' && /^\d+$/.test(value)) seconds = Number(value);
  else if (isDict(value) && typeof value.low === 'number') seconds = value.low;
  return seconds ? new Date(seconds * 1000) : new Date();
}

export function parseEvolutionEvent(payload: unknown): EvolutionEvent {
  if (!isDict(payload)) return { type: 'ignored' };
  const name = eventName(payload.event);
  const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  if (!isDict(data)) return { type: 'ignored' };

  if (name === 'connection.update') {
    return { type: 'connection', state: str(data.state) ?? 'unknown' };
  }
  if (name === 'qrcode.updated') {
    const qr = isDict(data.qrcode) ? str(data.qrcode.base64) : str(data.base64);
    return { type: 'qrcode', base64: qr ?? null };
  }
  if (name !== 'messages.upsert') return { type: 'ignored' };

  const key = isDict(data.key) ? data.key : {};
  const remoteJid = str(key.remoteJid) ?? '';
  const id = str(key.id);
  if (!id || !remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@newsletter')) {
    return { type: 'ignored' };
  }

  const isGroup = remoteJid.endsWith('@g.us');
  let phoneDigits = digitsFromJid(remoteJid);
  if (!phoneDigits && remoteJid.endsWith('@lid')) {
    phoneDigits =
      digitsFromJid(str(key.senderPn)) ??
      digitsFromJid(str(key.remoteJidAlt)) ??
      digitsFromJid(str(key.participantAlt)) ??
      digitsFromJid(str(data.senderPn));
  }

  return {
    type: 'message',
    id,
    fromMe: key.fromMe === true,
    phoneDigits: isGroup ? null : phoneDigits,
    text: messageText(data.message),
    isGroup,
    timestamp: timestamp(data.messageTimestamp),
  };
}
