import { describe, expect, it } from 'vitest';
import { whatsappLink } from '@/lib/whatsapp/link';

describe('whatsappLink', () => {
  it('opens a chat with the number and the message ready', () => {
    expect(whatsappLink('5519987654321', 'Oi, tudo bem?')).toBe('https://wa.me/5519987654321?text=Oi%2C%20tudo%20bem%3F');
  });

  it('keeps accents, emojis, links and line breaks', () => {
    const text = 'Olá!\nVeja a prévia: https://zap.vercel.app/s/ze-campinas 🙏';
    expect(new URL(whatsappLink('5519987654321', text)).searchParams.get('text')).toBe(text);
  });

  it('keeps only the digits of the number', () => {
    expect(whatsappLink('+55 (19) 98765-4321', 'x')).toBe('https://wa.me/5519987654321?text=x');
  });
});
