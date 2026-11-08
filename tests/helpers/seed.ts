import type { DB } from '@/lib/db/client';
import { businesses, sites, type Business, type NewBusiness, type Site } from '@/lib/db/schema';
import { fallbackContent } from '@/lib/sites/content';

let counter = 0;

/** Empresa com prévia pronta, para testes. */
export async function seedBusiness(
  db: DB,
  overrides: Partial<NewBusiness> = {},
): Promise<{ business: Business; site: Site }> {
  counter++;
  const [business] = await db
    .insert(businesses)
    .values({
      placeId: `place-${counter}`,
      name: `Barbearia ${counter}`,
      category: 'Barbearia',
      niche: 'beleza',
      city: 'Campinas',
      phoneDisplay: '(19) 98765-4321',
      phoneE164: '+5519987654321',
      phoneIsMobile: true,
      status: 'previa_pronta',
      ...overrides,
    })
    .returning();
  const [site] = await db
    .insert(sites)
    .values({
      businessId: business.id,
      slug: `barbearia-${counter}-campinas`,
      niche: business.niche,
      status: 'previa',
      content: fallbackContent({
        name: business.name,
        category: business.category,
        niche: business.niche,
        city: business.city,
        neighborhood: '',
        rating: null,
        reviewsCount: null,
        description: '',
        openingHours: [],
      }),
    })
    .returning();
  return { business, site };
}
