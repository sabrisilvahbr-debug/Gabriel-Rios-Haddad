import { describe, expect, it } from 'vitest';
import { NICHES } from '@/lib/constants';
import { detectNiche, NICHE_THEMES } from '@/lib/niches';

describe('detectNiche', () => {
  it.each([
    ['Barbearia', 'beleza'],
    ['Salão de beleza', 'beleza'],
    ['Pizzaria', 'alimentacao'],
    ['Padaria', 'alimentacao'],
    ['Oficina mecânica', 'automotivo'],
    ['Estética automotiva', 'automotivo'],
    ['Clínica veterinária', 'pet'],
    ['Pet shop', 'pet'],
    ['Clínica odontológica', 'saude'],
    ['Academia', 'fitness'],
    ['Eletricista', 'casa'],
    ['Loja de roupas', 'varejo'],
    ['Escritório de contabilidade', 'geral'],
  ])('%s → %s', (category, niche) => {
    expect(detectNiche(category)).toBe(niche);
  });

  it('uses the extra categories when the main one is generic', () => {
    expect(detectNiche('Empresa', ['Serviço', 'Lava-jato'])).toBe('automotivo');
  });

  it('does not confuse a bar snack shop with a pet shop', () => {
    expect(detectNiche('Petiscaria')).not.toBe('pet');
  });

  it('falls back to geral for empty input', () => {
    expect(detectNiche(null)).toBe('geral');
    expect(detectNiche('')).toBe('geral');
  });
});

describe('NICHE_THEMES', () => {
  it('has a complete theme for every niche', () => {
    for (const niche of NICHES) {
      const theme = NICHE_THEMES[niche];
      expect(theme.label).not.toBe('');
      expect(theme.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.defaultServices.length).toBeGreaterThanOrEqual(3);
      expect(theme.defaultHighlights.length).toBeGreaterThanOrEqual(3);
      expect(theme.serviceIcons.length).toBeGreaterThanOrEqual(3);
    }
  });
});
