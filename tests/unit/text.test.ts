import { describe, expect, it } from 'vitest';
import { normalizeText, slugify } from '@/lib/text';

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
