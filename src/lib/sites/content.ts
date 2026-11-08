import { z } from 'zod';
import type { Niche } from '@/lib/constants';
import { NICHE_THEMES } from '@/lib/niches';
import { truncate } from '@/lib/text';
import type { OpeningHour, SiteContent } from '@/lib/types';

export type { SiteContent } from '@/lib/types';

export const CONTENT_LIMITS = {
  heroTitle: 80,
  heroSubtitle: 160,
  about: 700,
  serviceTitle: 50,
  serviceDescription: 160,
  highlight: 60,
  ctaText: 40,
  seoDescription: 160,
  servicesMin: 3,
  servicesMax: 6,
  highlightsMin: 3,
  highlightsMax: 4,
} as const;

const L = CONTENT_LIMITS;

export const siteContentSchema = z.object({
  heroTitle: z.string().min(1).max(L.heroTitle),
  heroSubtitle: z.string().min(1).max(L.heroSubtitle),
  about: z.string().min(1).max(L.about),
  services: z
    .array(
      z.object({
        title: z.string().min(1).max(L.serviceTitle),
        description: z.string().min(1).max(L.serviceDescription),
      }),
    )
    .min(L.servicesMin)
    .max(L.servicesMax),
  highlights: z.array(z.string().min(1).max(L.highlight)).min(L.highlightsMin).max(L.highlightsMax),
  ctaText: z.string().min(1).max(L.ctaText),
  seoDescription: z.string().min(1).max(L.seoDescription),
}) satisfies z.ZodType<SiteContent>;

/** O que a IA (e o plano B) sabem sobre a empresa. */
export interface SiteCopyInput {
  name: string;
  category: string;
  niche: Niche;
  city: string;
  neighborhood: string;
  rating: number | null;
  reviewsCount: number | null;
  description: string;
  openingHours: OpeningHour[];
}

/** Textos padrão do ramo: sempre válidos, usados quando a IA falha. */
export function fallbackContent(input: SiteCopyInput): SiteContent {
  const theme = NICHE_THEMES[input.niche];
  const place = input.city ? `em ${input.city}` : 'na região';
  const highlights = [...theme.defaultHighlights];
  if (input.rating !== null && input.rating >= 4.5 && (input.reviewsCount ?? 0) >= 10) {
    highlights[highlights.length - 1] = `Nota ${input.rating.toFixed(1).replace('.', ',')} no Google`;
  }

  return {
    heroTitle: truncate(input.name, L.heroTitle),
    heroSubtitle: truncate(`${theme.tagline} ${place}.`, L.heroSubtitle),
    about: truncate(
      `A ${input.name} atende ${input.city || 'a região'} com ${theme.aboutPhrase}. ` +
        'Fale com a gente pelo WhatsApp para tirar dúvidas e conhecer melhor o nosso trabalho.',
      L.about,
    ),
    services: theme.defaultServices.map((s) => ({ ...s })),
    highlights: highlights.map((h) => truncate(h, L.highlight)),
    ctaText: 'Chamar no WhatsApp',
    seoDescription: truncate(
      `${input.name} ${place}: ${theme.tagline.toLowerCase()}. Veja endereço, horário e fale pelo WhatsApp.`,
      L.seoDescription,
    ),
  };
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? truncate(value.replace(/\s+/g, ' '), max) : '';
}

/**
 * Ajusta um conteúdo vindo de fora (IA ou formulário) aos limites: corta textos longos e
 * listas compridas. Devolve null se a estrutura não servir.
 */
export function clampContent(raw: unknown): SiteContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;

  const services = Array.isArray(data.services)
    ? data.services
        .map((s) => {
          const item = (s ?? {}) as Record<string, unknown>;
          return {
            title: text(item.title, L.serviceTitle),
            description: text(item.description, L.serviceDescription),
          };
        })
        .filter((s) => s.title && s.description)
        .slice(0, L.servicesMax)
    : [];

  const highlights = Array.isArray(data.highlights)
    ? data.highlights.map((h) => text(h, L.highlight)).filter(Boolean).slice(0, L.highlightsMax)
    : [];

  const candidate = {
    heroTitle: text(data.heroTitle, L.heroTitle),
    heroSubtitle: text(data.heroSubtitle, L.heroSubtitle),
    about: typeof data.about === 'string' ? truncate(data.about, L.about) : '',
    services,
    highlights,
    ctaText: text(data.ctaText, L.ctaText),
    seoDescription: text(data.seoDescription, L.seoDescription),
  };

  const parsed = siteContentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
