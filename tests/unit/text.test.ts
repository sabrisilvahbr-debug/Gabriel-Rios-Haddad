import { describe, expect, it } from 'vitest';
import { normalizeText, slugify, truncate } from '@/lib/text';

describe('truncate', () => {
  it('keeps short text untouched', () => {
    expect(truncate('  Olá mundo ', 20)).toBe('Olá mundo');
  });

  it('cuts at a word boundary within the limit', () => {
    const result = truncate('palavra '.repeat(20), 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith(' ')).toBe(false);
    expect(result.startsWith('palavra palavra')).toBe(true);
  });

  it('cuts long words hard', () => {
    expect(truncate('a'.repeat(120), 80)).toHaveLength(80);
  });
});

describe('slugify', () => {
  it('removes accents and punctuation', () => {
    expect(slugify('Barbearia do Zé — Centro')).toBe('barbearia-do-ze-centro');
  });

  it('returns empty for names without letters or digits', () => {
    expect(slugify('🍕🍕')).toBe('');
  });

  it('limits length to 60 without a trailing hyphen', () => {
    const slug = slugify('Restaurante e Pizzaria Sabor da Terra Natal Comida Caseira Mineira Delivery');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('normalizeText', () => {
  it('lowercases, strips accents and collapses spaces', () => {
    expect(normalizeText('  Não  QUERO! ')).toBe('nao quero!');
  });
});
