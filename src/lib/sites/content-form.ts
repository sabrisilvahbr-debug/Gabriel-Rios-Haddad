import type { SiteContent } from '@/lib/types';
import { clampContent, CONTENT_LIMITS } from './content';

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** Lê o formulário do editor (serviços e diferenciais numerados) e ajusta aos limites. */
export function parseContentForm(data: FormData): SiteContent | null {
  const services = Array.from({ length: CONTENT_LIMITS.servicesMax }, (_, i) => ({
    title: field(data, `service_title_${i}`),
    description: field(data, `service_desc_${i}`),
  })).filter((s) => s.title || s.description);

  const highlights = Array.from({ length: CONTENT_LIMITS.highlightsMax }, (_, i) => field(data, `highlight_${i}`)).filter(
    Boolean,
  );

  return clampContent({
    heroTitle: field(data, 'heroTitle'),
    heroSubtitle: field(data, 'heroSubtitle'),
    about: field(data, 'about'),
    services,
    highlights,
    ctaText: field(data, 'ctaText'),
    seoDescription: field(data, 'seoDescription'),
  });
}
