import { and, eq } from 'drizzle-orm';
import { generateSiteContent } from '@/lib/ai/site-copy';
import { getDb } from '@/lib/db/client';
import { businesses, sites, type Business, type Site } from '@/lib/db/schema';
import { getSettings } from '@/lib/db/settings';
import { hostWithoutPort } from '@/lib/routing';
import { slugify } from '@/lib/text';
import type { SitePhoto } from '@/lib/types';
import { NICHES, type Niche } from '@/lib/constants';
import { clampContent, type SiteCopyInput } from './content';

export interface SitePageData {
  site: Site;
  business: Business;
  agency: { name: string; whatsapp: string };
}

export function copyInputFor(business: Business): SiteCopyInput {
  return {
    name: business.name,
    category: business.category,
    niche: business.niche,
    city: business.city,
    neighborhood: business.neighborhood,
    rating: business.rating,
    reviewsCount: business.reviewsCount,
    description: business.description,
    openingHours: business.openingHours,
  };
}

export function googlePhotos(urls: string[]): SitePhoto[] {
  return urls.map((url) => ({ url, credit: 'Foto: Google Maps', source: 'google', authorized: false }));
}

async function getBusiness(id: string): Promise<Business | null> {
  const [row] = await getDb().select().from(businesses).where(eq(businesses.id, id)).limit(1);
  return row ?? null;
}

async function siteOfBusiness(businessId: string): Promise<Site | null> {
  const [row] = await getDb().select().from(sites).where(eq(sites.businessId, businessId)).limit(1);
  return row ?? null;
}

/** Cria o site de prévia de uma empresa (idempotente). */
export async function createSiteForBusiness(businessId: string): Promise<Site> {
  const existing = await siteOfBusiness(businessId);
  if (existing) return existing;
  const business = await getBusiness(businessId);
  if (!business) throw new Error('Empresa não encontrada.');

  const { content, source } = await generateSiteContent(copyInputFor(business));
  const base = slugify(`${business.name} ${business.city}`) || 'empresa';
  const values = {
    businessId,
    niche: business.niche,
    content,
    photos: googlePhotos(business.imageUrls),
    status: 'previa' as const,
    generationSource: source,
    generatedAt: new Date(),
  };

  let site: Site | undefined;
  for (let attempt = 1; attempt <= 50 && !site; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    try {
      [site] = await getDb()
        .insert(sites)
        .values({ ...values, slug })
        .onConflictDoNothing({ target: sites.slug })
        .returning();
    } catch (error) {
      // Outra chamada criou o site desta empresa ao mesmo tempo (business_id é único).
      const raced = await siteOfBusiness(businessId);
      if (raced) return raced;
      throw error;
    }
  }
  if (!site) {
    [site] = await getDb()
      .insert(sites)
      .values({ ...values, slug: `${base}-${crypto.randomUUID().slice(0, 8)}` })
      .returning();
  }

  await getDb()
    .update(businesses)
    .set({ status: 'previa_pronta', updatedAt: new Date() })
    .where(and(eq(businesses.id, businessId), eq(businesses.status, 'nova')));
  return site;
}

export async function regenerateSiteContent(siteId: string): Promise<Site> {
  const [site] = await getDb().select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new Error('Site não encontrado.');
  const business = await getBusiness(site.businessId);
  if (!business) throw new Error('Empresa não encontrada.');
  const { content, source } = await generateSiteContent(copyInputFor({ ...business, niche: site.niche }));
  const [updated] = await getDb()
    .update(sites)
    .set({ content, generationSource: source, generatedAt: new Date(), updatedAt: new Date() })
    .where(eq(sites.id, siteId))
    .returning();
  return updated;
}

/** Salva os textos editados no painel (ajustados aos limites) e o ramo/tema. */
export async function updateSiteContent(
  siteId: string,
  raw: unknown,
  niche: Niche,
): Promise<{ ok: boolean; message: string }> {
  const content = clampContent(raw);
  if (!content) {
    return {
      ok: false,
      message: 'Preencha título, subtítulo, texto sobre, botão, descrição para o Google, 3 serviços e 3 diferenciais.',
    };
  }
  if (!(NICHES as readonly string[]).includes(niche)) return { ok: false, message: 'Ramo inválido.' };
  await getDb().update(sites).set({ content, niche, updatedAt: new Date() }).where(eq(sites.id, siteId));
  return { ok: true, message: 'Textos salvos.' };
}

async function pageData(site: Site): Promise<SitePageData | null> {
  const business = await getBusiness(site.businessId);
  if (!business) return null;
  const settings = await getSettings();
  return { site, business, agency: { name: settings.agencyName, whatsapp: settings.agencyWhatsapp } };
}

export async function getPreviewBySlug(slug: string): Promise<SitePageData | null> {
  const [site] = await getDb().select().from(sites).where(eq(sites.slug, slug)).limit(1);
  return site ? pageData(site) : null;
}

/** Site oficial pelo domínio (com ou sem www). 'manutencao' = domínio ligado, site despublicado. */
export async function getPublishedByHost(host: string): Promise<SitePageData | 'manutencao' | null> {
  const bare = hostWithoutPort(host).replace(/^www\./, '');
  if (!bare) return null;
  const [site] = await getDb().select().from(sites).where(eq(sites.customDomain, bare)).limit(1);
  if (!site) return null;
  if (site.status !== 'publicado') return 'manutencao';
  return pageData(site);
}
