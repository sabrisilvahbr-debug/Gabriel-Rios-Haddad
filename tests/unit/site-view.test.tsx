import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteView, todayHours, visiblePhotos } from '@/components/site/SiteView';
import type { Business, Site } from '@/lib/db/schema';
import { fallbackContent } from '@/lib/sites/content';
import type { SitePageData } from '@/lib/sites/service';

const now = new Date('2026-11-09T15:00:00Z'); // segunda-feira, 12h em Brasília

function business(overrides: Partial<Business> = {}): Business {
  return {
    id: 'b1',
    searchId: null,
    placeId: 'p1',
    name: 'Barbearia do Zé',
    category: 'Barbearia',
    niche: 'beleza',
    address: 'Rua Barão de Jaguara, 100 - Centro, Campinas - SP',
    neighborhood: 'Centro',
    city: 'Campinas',
    state: 'São Paulo',
    phoneDisplay: '(19) 98765-4321',
    phoneE164: '+5519987654321',
    phoneIsMobile: true,
    waJid: null,
    whatsappStatus: 'unknown',
    rating: 4.8,
    reviewsCount: 120,
    mapsUrl: 'https://www.google.com/maps/place/?q=place_id:p1',
    openingHours: [
      { day: 'segunda-feira', hours: '09:00 to 19:00' },
      { day: 'domingo', hours: 'Fechado' },
    ],
    imageUrls: [],
    description: '',
    status: 'previa_pronta',
    aiPaused: false,
    aiReplyCount: 0,
    lastOutboundAt: null,
    lastInboundAt: null,
    optedOutAt: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function data(overrides: { business?: Partial<Business>; site?: Partial<Site> } = {}): SitePageData {
  const b = business(overrides.business);
  const site: Site = {
    id: 's1',
    businessId: b.id,
    slug: 'barbearia-do-ze-campinas',
    niche: b.niche,
    content: fallbackContent({ ...b, rating: b.rating, reviewsCount: b.reviewsCount }),
    photos: [
      { url: 'https://lh5.googleusercontent.com/p/google1', credit: 'Foto: Google Maps', source: 'google', authorized: false },
      { url: 'https://blob.vercel-storage.com/upload1.jpg', credit: '', source: 'upload', authorized: true },
    ],
    status: 'previa',
    customDomain: null,
    domainStatus: 'nenhum',
    domainError: null,
    generationSource: 'padrao',
    generatedAt: now,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides.site,
  };
  return { site, business: b, agency: { name: 'Agência Sol', whatsapp: '+5519900001111' } };
}

const render = (d: SitePageData, mode: 'preview' | 'published') =>
  renderToStaticMarkup(<SiteView data={d} mode={mode} now={now} />);

describe('SiteView', () => {
  it('shows the preview banner with the agency WhatsApp', () => {
    const html = render(data(), 'preview');
    expect(html).toContain('Prévia criada por');
    expect(html).toContain('Agência Sol');
    expect(html).toContain('https://wa.me/5519900001111');
  });

  it('has no preview banner when published', () => {
    const html = render(data({ site: { status: 'publicado' } }), 'published');
    expect(html).not.toContain('Prévia');
    expect(html).not.toContain('wa.me/5519900001111');
  });

  it('hides unauthorized Google photos on the published site', () => {
    expect(render(data(), 'preview')).toContain('google1');
    const published = render(data({ site: { status: 'publicado' } }), 'published');
    expect(published).not.toContain('google1');
    expect(published).toContain('upload1.jpg');
  });

  it('links mobiles to WhatsApp and landlines to a phone call', () => {
    expect(render(data(), 'preview')).toContain('https://wa.me/5519987654321');
    const landline = render(
      data({ business: { phoneE164: '+551932324545', phoneDisplay: '(19) 3232-4545', phoneIsMobile: false } }),
      'preview',
    );
    expect(landline).toContain('tel:+551932324545');
    expect(landline).not.toContain('wa.me/551932324545');
  });

  it('shows the Google rating and a link, never review texts', () => {
    const html = render(data(), 'preview');
    expect(html).toContain('4,8');
    expect(html).toContain('Ver avaliações no Google');
  });

  it('marks today in the opening hours', () => {
    const html = render(data(), 'preview');
    expect(html).toContain('Hoje: 09:00–19:00');
  });
});

describe('helpers', () => {
  it('visiblePhotos keeps everything in preview and only authorized when published', () => {
    const site = data().site;
    expect(visiblePhotos(site, 'preview')).toHaveLength(2);
    expect(visiblePhotos(site, 'published').map((p) => p.source)).toEqual(['upload']);
  });

  it('todayHours finds the Portuguese weekday', () => {
    expect(todayHours([{ day: 'segunda-feira', hours: '08:00 to 12:00' }], now)).toBe('08:00–12:00');
    expect(todayHours([{ day: 'terça-feira', hours: '08:00 to 12:00' }], now)).toBeNull();
  });
});
