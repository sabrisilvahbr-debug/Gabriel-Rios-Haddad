export interface SiteService {
  title: string;
  description: string;
}

/** Textos do site. Limites e validação em `src/lib/sites/content.ts`. */
export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  about: string;
  services: SiteService[];
  highlights: string[];
  ctaText: string;
  seoDescription: string;
}

export interface SitePhoto {
  url: string;
  credit: string;
  source: 'google' | 'upload';
  authorized: boolean;
}

export interface OpeningHour {
  day: string;
  hours: string;
}
