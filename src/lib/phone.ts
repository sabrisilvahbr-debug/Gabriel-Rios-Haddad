import { createHash } from 'node:crypto';

export interface NormalizedPhone {
  /** Ex.: +5511987654321 */
  e164: string;
  /** DDD + número, só dígitos. Ex.: 11987654321 */
  national: string;
  /** Ex.: (11) 98765-4321 */
  display: string;
  isMobile: boolean;
}

/** DDDs válidos no Brasil (Anatel). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87,
  88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const NON_GEOGRAPHIC = /^0(300|500|800|900)/;

function nationalDigits(raw: string): string | null {
  const withoutExtension = raw.split(/\b(?:ramal|ext\.?|extens[aã]o)\b/i)[0];
  const digits = withoutExtension.replace(/\D/g, '');
  if (!digits) return null;
  if (NON_GEOGRAPHIC.test(digits)) return null;

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
  if (digits.startsWith('0')) {
    let rest = digits.replace(/^0+/, '');
    // Código de operadora (0 XX DDD número): 2 dígitos a mais.
    if (rest.length === 12 || rest.length === 13) rest = rest.slice(2);
    return rest;
  }
  return digits;
}

export function normalizeBrazilPhone(raw: string | null | undefined): NormalizedPhone | null {
  if (!raw) return null;
  let national = nationalDigits(raw);
  if (!national || (national.length !== 10 && national.length !== 11)) return null;

  const ddd = Number(national.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return null;

  let subscriber = national.slice(2);
  if (subscriber.length === 8) {
    const first = subscriber[0];
    if (first >= '6' && first <= '9') {
      subscriber = `9${subscriber}`; // celular escrito sem o nono dígito
    } else if (first < '2' || first > '5') {
      return null;
    }
  } else if (subscriber[0] !== '9') {
    return null;
  }

  national = `${national.slice(0, 2)}${subscriber}`;
  const isMobile = subscriber.length === 9;
  const display = isMobile
    ? `(${national.slice(0, 2)}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
    : `(${national.slice(0, 2)}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;

  return { e164: `+55${national}`, national, display, isMobile };
}

/**
 * Variantes de busca para um número vindo do WhatsApp (só dígitos, com 55).
 * Alguns JIDs antigos não têm o nono dígito; outros têm. Tenta as duas formas.
 */
export function phoneLookupVariants(digits: string): string[] {
  const clean = digits.replace(/\D/g, '');
  const variants = [`+${clean}`];
  if (!clean.startsWith('55')) return variants;
  const ddd = clean.slice(2, 4);
  const subscriber = clean.slice(4);
  if (subscriber.length === 9 && subscriber.startsWith('9')) {
    variants.push(`+55${ddd}${subscriber.slice(1)}`);
  } else if (subscriber.length === 8 && subscriber[0] >= '6' && subscriber[0] <= '9') {
    variants.push(`+55${ddd}9${subscriber}`);
  }
  return variants;
}

export function hashPhone(e164: string): string {
  return createHash('sha256').update(e164).digest('hex');
}

/** Número no formato do WhatsApp (só dígitos, sem +). */
export function waNumber(e164: string): string {
  return e164.replace(/\D/g, '');
}
