import { describe, expect, it } from 'vitest';
import { hashPhone, normalizeBrazilPhone, phoneLookupVariants, waNumber } from '@/lib/phone';

describe('normalizeBrazilPhone', () => {
  it('normalizes a formatted mobile number', () => {
    expect(normalizeBrazilPhone('(11) 98765-4321')).toEqual({
      e164: '+5511987654321',
      national: '11987654321',
      display: '(11) 98765-4321',
      isMobile: true,
    });
  });

  it('accepts country code and a spaced ninth digit', () => {
    expect(normalizeBrazilPhone('+55 (11) 9 8765-4321')?.e164).toBe('+5511987654321');
  });

  it('recognizes landlines', () => {
    const phone = normalizeBrazilPhone('1132654321');
    expect(phone?.isMobile).toBe(false);
    expect(phone?.display).toBe('(11) 3265-4321');
  });

  it('adds the ninth digit to old-format mobiles', () => {
    expect(normalizeBrazilPhone('(19) 8765-4321')).toMatchObject({ e164: '+5519987654321', isMobile: true });
  });

  it('ignores extensions', () => {
    expect(normalizeBrazilPhone('(11) 98765-4321 ramal 2')?.e164).toBe('+5511987654321');
  });

  it('rejects non-geographic, short, empty and invalid numbers', () => {
    expect(normalizeBrazilPhone('0800 123 4567')).toBeNull();
    expect(normalizeBrazilPhone('123')).toBeNull();
    expect(normalizeBrazilPhone('')).toBeNull();
    expect(normalizeBrazilPhone(null)).toBeNull();
    expect(normalizeBrazilPhone(undefined)).toBeNull();
    expect(normalizeBrazilPhone('(20) 98765-4321')).toBeNull();
    expect(normalizeBrazilPhone('(11) 18765-4321')).toBeNull();
  });
});

describe('phoneLookupVariants', () => {
  it('adds the variant without the ninth digit', () => {
    expect(phoneLookupVariants('5511987654321')).toEqual(['+5511987654321', '+551187654321']);
  });

  it('adds the variant with the ninth digit', () => {
    expect(phoneLookupVariants('551187654321')).toEqual(['+551187654321', '+5511987654321']);
  });

  it('keeps landlines as they are', () => {
    expect(phoneLookupVariants('551132654321')).toEqual(['+551132654321']);
  });
});

describe('helpers', () => {
  it('hashPhone is a stable sha256 hex', () => {
    const hash = hashPhone('+5511987654321');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPhone('+5511987654321')).toBe(hash);
    expect(hashPhone('+5511987654322')).not.toBe(hash);
  });

  it('waNumber drops the plus sign', () => {
    expect(waNumber('+5511987654321')).toBe('5511987654321');
  });
});
