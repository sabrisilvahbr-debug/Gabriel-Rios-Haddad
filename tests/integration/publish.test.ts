import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { deleteBusiness } from '@/lib/businesses';
import type { DB } from '@/lib/db/client';
import { businesses, sites, type Site } from '@/lib/db/schema';
import { fallbackContent } from '@/lib/sites/content';
import { checkDomain, checkPendingDomains, connectDomain, disconnectDomain, publishSite, unpublishSite } from '@/lib/sites/publish';

let db: DB;
let calls: Array<{ method: string; url: string; body: unknown }>;
let configMisconfigured: boolean;
let addStatus: number;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  db = await createTestDb();
  calls = [];
  configMisconfigured = true;
  addStatus = 200;
  vi.stubEnv('VERCEL_API_TOKEN', 'vercel-token');
  vi.stubEnv('VERCEL_PROJECT_ID', 'prj_1');
  vi.stubEnv('VERCEL_TEAM_ID', 'team_1');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.includes('/v10/projects/prj_1/domains') && method === 'POST') {
        return addStatus === 200
          ? json({ name: 'x', verified: true })
          : json({ error: { code: 'invalid_domain', message: 'Invalid domain' } }, addStatus);
      }
      if (url.includes('/config')) {
        return json({
          misconfigured: configMisconfigured,
          recommendedIPv4: [{ rank: 1, value: ['76.76.21.21'] }],
          recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com.' }],
        });
      }
      if (url.includes('/v9/projects/prj_1/domains/') && method === 'GET') return json({ verified: true, verification: [] });
      if (method === 'DELETE') return json({});
      return json({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed(): Promise<Site> {
  const [business] = await db
    .insert(businesses)
    .values({
      placeId: 'p1',
      name: 'Padaria Pão Quente',
      niche: 'alimentacao',
      city: 'Campinas',
      phoneDisplay: '(19) 97777-8888',
      phoneE164: '+5519977778888',
      phoneIsMobile: true,
      status: 'interessada',
    })
    .returning();
  const [site] = await db
    .insert(sites)
    .values({
      businessId: business.id,
      slug: 'padaria-pao-quente-campinas',
      niche: 'alimentacao',
      status: 'previa',
      content: fallbackContent({
        name: business.name,
        category: 'Padaria',
        niche: 'alimentacao',
        city: 'Campinas',
        neighborhood: '',
        rating: null,
        reviewsCount: null,
        description: '',
        openingHours: [],
      }),
      photos: [{ url: 'https://lh5.googleusercontent.com/p/1', credit: 'Foto: Google Maps', source: 'google', authorized: false }],
    })
    .returning();
  return site;
}

const siteById = async (id: string) => (await db.select().from(sites).where(eq(sites.id, id)))[0];

describe('connectDomain', () => {
  it('adds the domain and its www redirect to the Vercel project', async () => {
    const site = await seed();
    const result = await connectDomain(site.id, 'https://www.Padaria.com.br');
    expect(result.ok).toBe(true);

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0].url).toBe('https://api.vercel.com/v10/projects/prj_1/domains?teamId=team_1');
    expect(posts[0].body).toEqual({ name: 'padaria.com.br' });
    expect(posts[1].body).toEqual({ name: 'www.padaria.com.br', redirect: 'padaria.com.br', redirectStatusCode: 308 });

    const saved = await siteById(site.id);
    expect(saved.customDomain).toBe('padaria.com.br');
    expect(saved.domainStatus).toBe('pendente');
  });

  it('explains invalid input and Vercel refusals', async () => {
    const site = await seed();
    expect((await connectDomain(site.id, 'padaria')).message).toMatch(/inválido/);
    addStatus = 400;
    const refused = await connectDomain(site.id, 'padaria.com.br');
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/Vercel/);
    expect((await siteById(site.id)).customDomain).toBeNull();
  });
});

describe('publishing', () => {
  it('requires an active domain and authorized photos', async () => {
    const site = await seed();
    await connectDomain(site.id, 'padaria.com.br');

    const noDomain = await publishSite(site.id);
    expect(noDomain.ok).toBe(false);
    expect(noDomain.message).toMatch(/domínio/);

    configMisconfigured = false;
    expect(await checkDomain(site.id)).toBe('ativo');

    const photos = await publishSite(site.id);
    expect(photos.ok).toBe(false);
    expect(photos.message).toMatch(/fotos/);

    await db
      .update(sites)
      .set({ photos: [{ url: 'https://lh5.googleusercontent.com/p/1', credit: 'Foto: Google Maps', source: 'google', authorized: true }] })
      .where(eq(sites.id, site.id));
    expect((await publishSite(site.id)).ok).toBe(true);

    const published = await siteById(site.id);
    expect(published.status).toBe('publicado');
    expect(published.publishedAt).not.toBeNull();
    const [business] = await db.select().from(businesses).where(eq(businesses.id, site.businessId));
    expect(business.status).toBe('cliente');

    await unpublishSite(site.id);
    expect((await siteById(site.id)).status).toBe('previa');
  });

  it('checkPendingDomains activates configured domains', async () => {
    const site = await seed();
    await connectDomain(site.id, 'padaria.com.br');
    configMisconfigured = false;
    await checkPendingDomains();
    expect((await siteById(site.id)).domainStatus).toBe('ativo');
  });
});

describe('removing domains', () => {
  it('disconnectDomain removes both hosts from Vercel and unpublishes', async () => {
    const site = await seed();
    await connectDomain(site.id, 'padaria.com.br');
    await db.update(sites).set({ status: 'publicado', domainStatus: 'ativo' }).where(eq(sites.id, site.id));

    await disconnectDomain(site.id);
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
    expect(deletes).toEqual([
      'https://api.vercel.com/v9/projects/prj_1/domains/padaria.com.br?teamId=team_1',
      'https://api.vercel.com/v9/projects/prj_1/domains/www.padaria.com.br?teamId=team_1',
    ]);
    const saved = await siteById(site.id);
    expect(saved.customDomain).toBeNull();
    expect(saved.domainStatus).toBe('nenhum');
    expect(saved.status).toBe('previa');
  });

  it('deleting a business also removes its domain from Vercel', async () => {
    const site = await seed();
    await connectDomain(site.id, 'padaria.com.br');
    await deleteBusiness(site.businessId);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(2);
  });
});
