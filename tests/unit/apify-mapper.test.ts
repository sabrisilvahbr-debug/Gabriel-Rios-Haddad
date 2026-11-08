import { describe, expect, it } from 'vitest';
import items from '../fixtures/apify-items.json';
import { buildActorInput } from '@/lib/apify/client';
import { mapPlace } from '@/lib/apify/mapper';

describe('buildActorInput', () => {
  it('asks only for open places without a website, in Portuguese', () => {
    expect(buildActorInput('barbearia', 'Campinas, SP', 30)).toEqual({
      searchStringsArray: ['barbearia'],
      locationQuery: 'Campinas, SP, Brasil',
      maxCrawledPlacesPerSearch: 30,
      language: 'pt-BR',
      countryCode: 'br',
      website: 'withoutWebsite',
      skipClosedPlaces: true,
      scrapePlaceDetailPage: true,
      maxImages: 6,
      maxReviews: 0,
    });
  });

  it('caps the number of places at 100', () => {
    expect(buildActorInput('padaria', 'Campinas', 500).maxCrawledPlacesPerSearch).toBe(100);
    expect(buildActorInput('padaria', 'Campinas', 0).maxCrawledPlacesPerSearch).toBe(1);
  });

  it('does not repeat the country', () => {
    expect(buildActorInput('padaria', 'Campinas, Brasil', 10).locationQuery).toBe('Campinas, Brasil');
  });
});

describe('mapPlace', () => {
  const opts = { includeLandlines: false };

  it('maps a valid place', () => {
    const result = mapPlace(items[0], opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.place).toMatchObject({
      placeId: 'p1',
      name: 'Barbearia do Zé',
      category: 'Barbearia',
      niche: 'beleza',
      city: 'Campinas',
      neighborhood: 'Centro',
      rating: 4.8,
      reviewsCount: 120,
      mapsUrl: 'https://www.google.com/maps/place/?q=place_id:p1',
    });
    expect(result.place.phone.e164).toBe('+5519987654321');
    expect(result.place.imageUrls).toEqual([
      'https://lh5.googleusercontent.com/p/foto1',
      'https://lh5.googleusercontent.com/p/foto2',
    ]);
    expect(result.place.openingHours).toEqual([
      { day: 'segunda-feira', hours: '09:00 to 19:00' },
      { day: 'domingo', hours: 'Fechado' },
    ]);
  });

  it('uses phoneUnformatted when phone is missing', () => {
    const result = mapPlace(items[1], opts);
    expect(result.ok && result.place.phone.e164).toBe('+5519991112222');
  });

  it('skips places with a website, closed places and landlines', () => {
    expect(mapPlace(items[2], opts)).toEqual({ ok: false, reason: 'tem_site' });
    expect(mapPlace(items[3], opts)).toEqual({ ok: false, reason: 'fechada' });
    expect(mapPlace(items[4], opts)).toEqual({ ok: false, reason: 'telefone_fixo' });
    expect(mapPlace({ ...items[3], permanentlyClosed: false, temporarilyClosed: true }, opts)).toEqual({
      ok: false,
      reason: 'fechada',
    });
  });

  it('keeps landlines when the setting allows it', () => {
    expect(mapPlace(items[4], { includeLandlines: true }).ok).toBe(true);
  });

  it('skips places without a usable phone and invalid items', () => {
    expect(mapPlace({ ...items[5], phone: '0800 123 4567' }, opts)).toEqual({ ok: false, reason: 'sem_telefone' });
    expect(mapPlace({ title: 'Sem id' }, opts)).toEqual({ ok: false, reason: 'invalido' });
    expect(mapPlace('lixo', opts)).toEqual({ ok: false, reason: 'invalido' });
  });
});
