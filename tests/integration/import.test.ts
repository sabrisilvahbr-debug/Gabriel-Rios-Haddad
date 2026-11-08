import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import items from '../fixtures/apify-items.json';
import { createTestDb } from '../helpers/db';
import { importSearchResults, processApifyWebhook, refreshSearch, startSearch } from '@/lib/apify/import';
import type { DB } from '@/lib/db/client';
import { blockedPhones, businesses, events, searches, sites } from '@/lib/db/schema';
import { hashPhone } from '@/lib/phone';
import { getPreviewBySlug, getPublishedByHost } from '@/lib/sites/service';

let db: DB;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv('APIFY_TOKEN', 'apify-token');
  vi.stubEnv('APIFY_WEBHOOK_SECRET', 'segredo-webhook');
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  vi.stubEnv('GEMINI_API_KEY', '');
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/datasets/ds1/items')) return json(items);
    if (url.includes('/actor-runs/run1')) return json({ data: { id: 'run1', status: 'SUCCEEDED', defaultDatasetId: 'ds1' } });
    if (url.includes('/actor-runs/run2')) return json({ data: { id: 'run2', status: 'FAILED', defaultDatasetId: 'ds2' } });
    if (url.includes('/acts/')) return json({ data: { id: 'run1', defaultDatasetId: 'ds1', status: 'READY' } });
    return json({ error: 'not mocked' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seedSearch(runId = 'run1') {
  const [search] = await db
    .insert(searches)
    .values({ term: 'barbearia', location: 'Campinas, SP', maxResults: 30, apifyRunId: runId, apifyDatasetId: 'ds1' })
    .returning();
  return search;
}

describe('startSearch', () => {
  it('starts the Apify actor with a signed webhook', async () => {
    const search = await startSearch({ term: ' barbearia ', location: 'Campinas, SP', maxResults: 30 });
    expect(search.status).toBe('running');
    expect(search.apifyRunId).toBe('run1');
    expect(search.term).toBe('barbearia');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://api.apify.com/v2/acts/compass~crawler-google-places/runs?webhooks=');
    expect(init.headers.authorization).toBe('Bearer apify-token');
    expect(JSON.parse(init.body).website).toBe('withoutWebsite');
    const webhooks = JSON.parse(Buffer.from(decodeURIComponent(url.split('webhooks=')[1]), 'base64').toString());
    expect(webhooks[0].requestUrl).toBe('https://zap.vercel.app/api/webhooks/apify?token=segredo-webhook');
    expect(webhooks[0].eventTypes).toContain('ACTOR.RUN.SUCCEEDED');
  });

  it('marks the search as failed when Apify refuses', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'token inválido' } }, 401));
    const search = await startSearch({ term: 'barbearia', location: 'Campinas', maxResults: 30 });
    expect(search.status).toBe('failed');
    expect(search.error).toMatch(/401/);
  });
});

describe('importSearchResults', () => {
  it('imports only useful businesses and creates their previews', async () => {
    await db.insert(blockedPhones).values({ phoneHash: hashPhone('+5519977778888') });
    const search = await seedSearch();

    const result = await importSearchResults(search.id);
    expect(result).toEqual({ found: 6, imported: 2, skipped: 4 });

    const savedSites = await db.select().from(sites);
    expect(savedSites.map((s) => s.slug).sort()).toEqual(['barbearia-do-ze-campinas', 'barbearia-do-ze-campinas-2']);
    expect(savedSites.every((s) => s.status === 'previa' && s.generationSource === 'padrao')).toBe(true);

    const saved = await db.select().from(businesses);
    expect(saved.every((b) => b.status === 'previa_pronta')).toBe(true);
    const ze = saved.find((b) => b.placeId === 'p1');
    const zeSite = savedSites.find((s) => s.businessId === ze?.id);
    expect(zeSite?.photos).toEqual([
      { url: 'https://lh5.googleusercontent.com/p/foto1', credit: 'Foto: Google Maps', source: 'google', authorized: false },
      { url: 'https://lh5.googleusercontent.com/p/foto2', credit: 'Foto: Google Maps', source: 'google', authorized: false },
    ]);

    const [updated] = await db.select().from(searches).where(eq(searches.id, search.id));
    expect(updated.status).toBe('imported');
    expect(updated.importedCount).toBe(2);
    expect((await db.select().from(events)).length).toBeGreaterThan(0);
  });

  it('is idempotent', async () => {
    const search = await seedSearch();
    await importSearchResults(search.id);
    await importSearchResults(search.id);
    expect(await db.select().from(businesses)).toHaveLength(3);
    expect(await db.select().from(sites)).toHaveLength(3);
  });

  it('skips places already imported by another search', async () => {
    const first = await seedSearch();
    await importSearchResults(first.id);
    const second = await seedSearch();
    const result = await importSearchResults(second.id);
    expect(result.imported).toBe(0);
    expect(await db.select().from(businesses)).toHaveLength(3);
  });

  it('finishes previews left behind by an interrupted import', async () => {
    const search = await seedSearch();
    await importSearchResults(search.id);
    const [victim] = await db.select().from(businesses).limit(1);
    await db.delete(sites).where(eq(sites.businessId, victim.id));
    await db.update(businesses).set({ status: 'nova' }).where(eq(businesses.id, victim.id));
    await db.update(searches).set({ status: 'succeeded' }).where(eq(searches.id, search.id));

    const result = await importSearchResults(search.id);
    expect(await db.select().from(sites).where(eq(sites.businessId, victim.id))).toHaveLength(1);
    expect((await db.select().from(businesses).where(eq(businesses.id, victim.id)))[0].status).toBe('previa_pronta');
    expect(result.imported).toBe(3);
    expect((await db.select().from(searches).where(eq(searches.id, search.id)))[0].status).toBe('imported');
  });

  it('keeps one business per phone when Google lists the same number twice', async () => {
    const twin = { ...items[0], placeId: 'p1-bis', title: 'Barbearia do Zé - Unidade 2' };
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/datasets/ds1/items') ? json([...items, twin]) : json({ error: 'not mocked' }, 404),
    );
    const search = await seedSearch();
    const result = await importSearchResults(search.id);
    expect(result.imported).toBe(3);
    const rows = await db.select().from(businesses).where(eq(businesses.phoneE164, '+5519987654321'));
    expect(rows).toHaveLength(1);
  });
});

describe('refreshSearch and webhooks', () => {
  it('imports when the run succeeded', async () => {
    const search = await seedSearch('run1');
    const refreshed = await refreshSearch(search.id);
    expect(refreshed.status).toBe('imported');
  });

  it('marks failed runs', async () => {
    const search = await seedSearch('run2');
    const refreshed = await refreshSearch(search.id);
    expect(refreshed.status).toBe('failed');
    expect(refreshed.error).toMatch(/FAILED/);
  });

  it('processes the Apify webhook payload', async () => {
    const search = await seedSearch('run1');
    await processApifyWebhook({
      eventType: 'ACTOR.RUN.SUCCEEDED',
      eventData: { actorRunId: 'run1' },
      resource: { id: 'run1', status: 'SUCCEEDED', defaultDatasetId: 'ds1' },
    });
    const [updated] = await db.select().from(searches).where(eq(searches.id, search.id));
    expect(updated.status).toBe('imported');
  });
});

describe('site lookups', () => {
  it('finds previews by slug and published sites by host', async () => {
    const search = await seedSearch();
    await importSearchResults(search.id);

    const preview = await getPreviewBySlug('barbearia-do-ze-campinas');
    expect(preview?.business.name).toBe('Barbearia do Zé');
    expect(await getPreviewBySlug('nao-existe')).toBeNull();

    await db
      .update(sites)
      .set({ customDomain: 'barbeariadoze.com.br', status: 'publicado' })
      .where(eq(sites.slug, 'barbearia-do-ze-campinas'));
    const published = await getPublishedByHost('www.BarbeariaDoZe.com.br');
    expect(published && published !== 'manutencao' && published.site.slug).toBe('barbearia-do-ze-campinas');

    await db.update(sites).set({ status: 'previa' }).where(eq(sites.slug, 'barbearia-do-ze-campinas'));
    expect(await getPublishedByHost('barbeariadoze.com.br')).toBe('manutencao');
    expect(await getPublishedByHost('outro.com.br')).toBeNull();
  });
});
