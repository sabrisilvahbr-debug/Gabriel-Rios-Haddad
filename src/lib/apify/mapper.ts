import { z } from 'zod';
import type { Niche } from '@/lib/constants';
import { detectNiche } from '@/lib/niches';
import { normalizeBrazilPhone, type NormalizedPhone } from '@/lib/phone';
import type { OpeningHour } from '@/lib/types';

const placeSchema = z.object({
  placeId: z.string().min(1),
  title: z.string().min(1),
  categoryName: z.string().nullish(),
  categories: z.array(z.unknown()).nullish(),
  address: z.string().nullish(),
  neighborhood: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  website: z.string().nullish(),
  phone: z.string().nullish(),
  phoneUnformatted: z.string().nullish(),
  totalScore: z.number().nullish(),
  reviewsCount: z.number().nullish(),
  url: z.string().nullish(),
  imageUrl: z.string().nullish(),
  imageUrls: z.array(z.unknown()).nullish(),
  openingHours: z.array(z.unknown()).nullish(),
  permanentlyClosed: z.boolean().nullish(),
  temporarilyClosed: z.boolean().nullish(),
  description: z.string().nullish(),
});

export interface MappedPlace {
  placeId: string;
  name: string;
  category: string;
  categories: string[];
  niche: Niche;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: NormalizedPhone;
  rating: number | null;
  reviewsCount: number | null;
  mapsUrl: string;
  openingHours: OpeningHour[];
  imageUrls: string[];
  description: string;
}

export type SkipReason = 'invalido' | 'tem_site' | 'fechada' | 'sem_telefone' | 'telefone_fixo';

export type MapResult = { ok: true; place: MappedPlace } | { ok: false; reason: SkipReason };

const MAX_IMAGES = 6;

function images(main: string | null | undefined, list: unknown[] | null | undefined): string[] {
  const all = [main, ...(list ?? [])].filter(
    (url): url is string => typeof url === 'string' && /^https?:\/\//.test(url),
  );
  return [...new Set(all)].slice(0, MAX_IMAGES);
}

function hours(list: unknown[] | null | undefined): OpeningHour[] {
  return (list ?? []).flatMap((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return typeof entry.day === 'string' && typeof entry.hours === 'string'
      ? [{ day: entry.day, hours: entry.hours }]
      : [];
  });
}

/** Converte um item do Apify numa empresa útil, ou diz por que ela foi descartada. */
export function mapPlace(item: unknown, options: { includeLandlines: boolean }): MapResult {
  const parsed = placeSchema.safeParse(item);
  if (!parsed.success) return { ok: false, reason: 'invalido' };
  const p = parsed.data;

  if (p.website && p.website.trim() !== '') return { ok: false, reason: 'tem_site' };
  if (p.permanentlyClosed || p.temporarilyClosed) return { ok: false, reason: 'fechada' };

  const phone = normalizeBrazilPhone(p.phone) ?? normalizeBrazilPhone(p.phoneUnformatted);
  if (!phone) return { ok: false, reason: 'sem_telefone' };
  if (!phone.isMobile && !options.includeLandlines) return { ok: false, reason: 'telefone_fixo' };

  const categories = (p.categories ?? []).filter((c): c is string => typeof c === 'string');
  const category = p.categoryName ?? categories[0] ?? '';

  return {
    ok: true,
    place: {
      placeId: p.placeId,
      name: p.title.trim(),
      category,
      categories,
      niche: detectNiche(category, categories),
      address: p.address ?? '',
      neighborhood: p.neighborhood ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      phone,
      rating: p.totalScore ?? null,
      reviewsCount: p.reviewsCount ?? null,
      mapsUrl: p.url ?? '',
      openingHours: hours(p.openingHours),
      imageUrls: images(p.imageUrl, p.imageUrls),
      description: p.description ?? '',
    },
  };
}
