import { describe, expect, it } from 'vitest';
import { isOptOut, looksLikeAutoReply } from '@/lib/whatsapp/detect';
import { parseEvolutionEvent } from '@/lib/whatsapp/webhook';

const upsert = (data: Record<string, unknown>, event = 'messages.upsert') => ({ event, instance: 'zapflow', data });

describe('parseEvolutionEvent', () => {
  it('reads a text message in both event spellings', () => {
    for (const name of ['messages.upsert', 'MESSAGES_UPSERT']) {
      expect(
        parseEvolutionEvent(
          upsert(
            {
              key: { remoteJid: '5519987654321@s.whatsapp.net', fromMe: false, id: 'ABC' },
              message: { conversation: 'Oi, quanto custa?' },
              messageTimestamp: 1762700000,
            },
            name,
          ),
        ),
      ).toEqual({
        type: 'message',
        id: 'ABC',
        fromMe: false,
        phoneDigits: '5519987654321',
        text: 'Oi, quanto custa?',
        isGroup: false,
        timestamp: new Date(1762700000 * 1000),
      });
    }
  });

  it('reads extended text and captions', () => {
    const extended = parseEvolutionEvent(
      upsert({ key: { remoteJid: '5519987654321@s.whatsapp.net', fromMe: true, id: 'X' }, message: { extendedTextMessage: { text: 'Veja: https://x' } } }),
    );
    expect(extended).toMatchObject({ type: 'message', fromMe: true, text: 'Veja: https://x' });
    const photo = parseEvolutionEvent(
      upsert({ key: { remoteJid: '5519987654321@s.whatsapp.net', fromMe: false, id: 'Y' }, message: { imageMessage: {} } }),
    );
    expect(photo).toMatchObject({ text: '[imagem]' });
  });

  it('flags groups and handles @lid addresses', () => {
    expect(
      parseEvolutionEvent(upsert({ key: { remoteJid: '1203630@g.us', fromMe: false, id: 'G' }, message: { conversation: 'oi' } })),
    ).toMatchObject({ isGroup: true });
    expect(
      parseEvolutionEvent(upsert({ key: { remoteJid: '123456789@lid', fromMe: false, id: 'L1' }, message: { conversation: 'oi' } })),
    ).toMatchObject({ phoneDigits: null });
    expect(
      parseEvolutionEvent(
        upsert({
          key: { remoteJid: '123456789@lid', senderPn: '5519987654321@s.whatsapp.net', fromMe: false, id: 'L2' },
          message: { conversation: 'oi' },
        }),
      ),
    ).toMatchObject({ phoneDigits: '5519987654321' });
  });

  it('ignores status broadcasts, unknown events and garbage', () => {
    expect(parseEvolutionEvent(upsert({ key: { remoteJid: 'status@broadcast', id: 'S' }, message: { conversation: 'x' } }))).toEqual({
      type: 'ignored',
    });
    expect(parseEvolutionEvent({ event: 'contacts.update', data: {} })).toEqual({ type: 'ignored' });
    expect(parseEvolutionEvent(null)).toEqual({ type: 'ignored' });
  });

  it('reads connection and QR code events', () => {
    expect(parseEvolutionEvent({ event: 'connection.update', data: { state: 'open', statusReason: 200 } })).toEqual({
      type: 'connection',
      state: 'open',
    });
    expect(parseEvolutionEvent({ event: 'QRCODE_UPDATED', data: { qrcode: { base64: 'data:image/png;base64,AA' } } })).toEqual({
      type: 'qrcode',
      base64: 'data:image/png;base64,AA',
    });
  });
});

describe('isOptOut', () => {
  it.each(['SAIR', 'sair', 'Sair.', 'PARAR', 'Stop', 'Não', 'não quero', 'Não tenho interesse, obrigado', 'pare de mandar', 'Por favor, me tira dessa lista'])(
    '%s → sai',
    (text) => expect(isOptOut(text)).toBe(true),
  );

  it.each(['pode sair amanhã?', 'Quero sim!', 'Não, quero sim', 'Quanto custa?', 'não sei ainda, me manda o preço'])(
    '%s → continua',
    (text) => expect(isOptOut(text)).toBe(false),
  );
});

describe('looksLikeAutoReply', () => {
  it('recognizes common automatic greetings', () => {
    expect(looksLikeAutoReply('Olá! Obrigado pelo contato, em breve retornaremos.')).toBe(true);
    expect(looksLikeAutoReply('Esta é uma mensagem automática.')).toBe(true);
    expect(looksLikeAutoReply('Nosso horário de atendimento é de segunda a sexta.')).toBe(true);
  });

  it('does not flag a real answer', () => {
    expect(looksLikeAutoReply('Oi, tudo bem? Quanto custa o site?')).toBe(false);
  });
});
