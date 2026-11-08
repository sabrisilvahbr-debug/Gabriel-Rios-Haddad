import { describe, expect, it } from 'vitest';
import { parseContentForm } from '@/lib/sites/content-form';
import { validateUpload } from '@/lib/sites/photos';
import { parseSettingsForm } from '@/lib/settings-form';

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

const validSettings = {
  agencyName: 'Agência Sol',
  agencyWhatsapp: '(19) 99000-1111',
  defaultMaxResults: '30',
  dailyLimit: '20',
  windowDays: ['1', '2', '3', '4', '5', '6'],
  windowStartHour: '9',
  windowEndHour: '18',
  minIntervalMin: '4',
  maxIntervalMin: '12',
  messageTemplates: ['Oi {empresa}! Veja: {link}. Responda SAIR para não receber.', '', 'Olá! {link}'],
  followUpAfterDays: '3',
  followUpTemplate: 'Viu a prévia? {link}',
  aiMaxReplies: '8',
  offerText: 'Site por R$ 497 à vista.',
};

describe('validateUpload', () => {
  it('accepts JPG, PNG and WebP up to 5 MB', () => {
    expect(validateUpload({ type: 'image/jpeg', size: 1_000_000 })).toBeNull();
    expect(validateUpload({ type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull();
    expect(validateUpload({ type: 'image/webp', size: 10 })).toBeNull();
  });

  it('rejects other formats, empty files and files over 5 MB', () => {
    expect(validateUpload({ type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG ou WebP/);
    expect(validateUpload({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(validateUpload({ type: 'image/jpeg', size: 0 })).toMatch(/vazio/);
  });
});

describe('parseSettingsForm', () => {
  it('normalizes a valid form', () => {
    const result = parseSettingsForm(form({ ...validSettings, outreachEnabled: 'on' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.agencyWhatsapp).toBe('+5519990001111');
    expect(result.patch.outreachEnabled).toBe(true);
    expect(result.patch.includeLandlines).toBe(false);
    expect(result.patch.windowDays).toBe('1,2,3,4,5,6');
    expect(result.patch.messageTemplates).toHaveLength(2);
  });

  it('accepts an empty agency WhatsApp', () => {
    const result = parseSettingsForm(form({ ...validSettings, agencyWhatsapp: '' }));
    expect(result.ok && result.patch.agencyWhatsapp).toBe('');
  });

  it('rejects a landline as the agency WhatsApp', () => {
    const result = parseSettingsForm(form({ ...validSettings, agencyWhatsapp: '(19) 3232-4545' }));
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/celular/) });
  });

  it('requires {link} in every first-contact template', () => {
    const result = parseSettingsForm(form({ ...validSettings, messageTemplates: ['Oi {empresa}!'] }));
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/\{link\}/) });
  });

  it('rejects a window that ends before it starts and inverted intervals', () => {
    expect(parseSettingsForm(form({ ...validSettings, windowStartHour: '18', windowEndHour: '9' })).ok).toBe(false);
    expect(parseSettingsForm(form({ ...validSettings, minIntervalMin: '20', maxIntervalMin: '5' })).ok).toBe(false);
    expect(parseSettingsForm(form({ ...validSettings, windowDays: [] })).ok).toBe(false);
  });
});

describe('parseContentForm', () => {
  it('builds services and highlights from the numbered fields, skipping empty rows', () => {
    const content = parseContentForm(
      form({
        heroTitle: 'Barbearia do Zé',
        heroSubtitle: 'Corte e barba.',
        about: 'Sobre nós.',
        service_title_0: 'Corte',
        service_desc_0: 'Na tesoura.',
        service_title_1: '',
        service_desc_1: '',
        service_title_2: 'Barba',
        service_desc_2: 'Com toalha quente.',
        service_title_3: 'Sobrancelha',
        service_desc_3: 'Rápida.',
        highlight_0: 'Rápido',
        highlight_1: '',
        highlight_2: 'Perto',
        highlight_3: 'Bom preço',
        ctaText: 'Chamar',
        seoDescription: 'Barbearia em Campinas.',
      }),
    );
    expect(content?.services.map((s) => s.title)).toEqual(['Corte', 'Barba', 'Sobrancelha']);
    expect(content?.highlights).toEqual(['Rápido', 'Perto', 'Bom preço']);
  });

  it('returns null when required parts are missing', () => {
    expect(parseContentForm(form({ heroTitle: 'Só título' }))).toBeNull();
  });
});
