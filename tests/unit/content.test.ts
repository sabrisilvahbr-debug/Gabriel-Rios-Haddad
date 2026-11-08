import { describe, expect, it } from 'vitest';
import { NICHES } from '@/lib/constants';
import { clampContent, fallbackContent, siteContentSchema, type SiteCopyInput } from '@/lib/sites/content';

const input = (overrides: Partial<SiteCopyInput> = {}): SiteCopyInput => ({
  name: 'Barbearia do Zé',
  category: 'Barbearia',
  niche: 'beleza',
  city: 'Campinas',
  neighborhood: 'Centro',
  rating: 4.8,
  reviewsCount: 120,
  description: '',
  openingHours: [],
  ...overrides,
});

const valid = () => ({
  heroTitle: 'Barbearia do Zé',
  heroSubtitle: 'Cortes clássicos e modernos no Centro de Campinas.',
  about: 'Somos uma barbearia de bairro.',
  services: [
    { title: 'Corte', description: 'Corte na tesoura ou na máquina.' },
    { title: 'Barba', description: 'Barba feita com toalha quente.' },
    { title: 'Sobrancelha', description: 'Acabamento rápido.' },
  ],
  highlights: ['Atendimento rápido', 'Ambiente climatizado', 'Fale pelo WhatsApp'],
  ctaText: 'Chamar no WhatsApp',
  seoDescription: 'Barbearia no Centro de Campinas.',
});

describe('fallbackContent', () => {
  it.each(NICHES.map((niche) => [niche]))('is valid for %s and uses the business name', (niche) => {
    const content = fallbackContent(input({ niche }));
    expect(siteContentSchema.safeParse(content).success).toBe(true);
    expect(content.heroTitle).toContain('Barbearia do Zé');
  });

  it('works without a city', () => {
    const content = fallbackContent(input({ city: '' }));
    expect(siteContentSchema.safeParse(content).success).toBe(true);
    expect(content.about).not.toContain('undefined');
  });
});

describe('clampContent', () => {
  it('cuts long titles to the limit', () => {
    const content = clampContent({ ...valid(), heroTitle: 'a'.repeat(120) });
    expect(content?.heroTitle).toHaveLength(80);
  });

  it('keeps at most six services', () => {
    const services = Array.from({ length: 8 }, (_, i) => ({ title: `Serviço ${i}`, description: 'Descrição' }));
    expect(clampContent({ ...valid(), services })?.services).toHaveLength(6);
  });

  it('rejects content without services', () => {
    expect(clampContent({ ...valid(), services: [] })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(clampContent('oops')).toBeNull();
    expect(clampContent(null)).toBeNull();
  });
});
