import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import items from '../fixtures/apify-items.json';
import { createTestDb } from '../helpers/db';

const { scheduled, blobPut, blobDel } = vi.hoisted(() => ({
  scheduled: [] as Array<() => Promise<void>>,
  blobPut: vi.fn(async (path: string) => ({ url: `https://blob.example/${path}` })),
  blobDel: vi.fn(async (_url: string) => undefined),
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => Promise<void>) => {
    scheduled.push(fn);
  },
}));
vi.mock('@vercel/blob', () => ({ put: blobPut, del: blobDel }));

import { POST as apifyWebhook } from '@/app/api/webhooks/apify/route';
import { importSearchResults } from '@/lib/apify/import';
import { deleteBusiness, listBusinesses, updateBusinessStatus } from '@/lib/businesses';
import type { DB } from '@/lib/db/client';
import { blockedPhones, businesses, events, messages, searches, sites } from '@/lib/db/schema';
import { countByStatus } from '@/lib/panel/stats';
import { addUploadedPhoto, removePhoto, setPhotoAuthorized } from '@/lib/sites/photos';
import { updateSiteContent } from '@/lib/sites/service';

let db: DB;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  db = await createTestDb();
  scheduled.length = 0;
  blobPut.mockClear();
  blobDel.mockClear();
  vi.stubEnv('APIFY_TOKEN', 'apify-token');
  vi.stubEnv('APIFY_WEBHOOK_SECRET', 'segredo-webhook');
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/datasets/ds1/items')) return json(items);
      if (url.includes('/actor-runs/run1')) return json({ data: { id: 'run1', status: 'SUCCEEDED', defaultDatasetId: 'ds1' } });
      return json({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function importFixture() {
  const [search] = await db
    .insert(searches)
    .values({ term: 'barbearia', location: 'Campinas', maxResults: 30, apifyRunId: 'run1', apifyDatasetId: 'ds1' })
    .returning();
  await importSearchResults(search.id);
  const [business] = await db.select().from(businesses).where(eq(businesses.placeId, 'p1'));
  const [site] = await db.select().from(sites).where(eq(sites.businessId, business.id));
  return { search, business, site };
}

describe('Apify webhook route', () => {
  const call = (token: string, body: unknown) =>
    apifyWebhook(
      new Request(`https://zap.vercel.app/api/webhooks/apify?token=${token}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
    );

  it('rejects a wrong token', async () => {
    const response = await call('errado', {});
    expect(response.status).toBe(401);
    expect(scheduled).toHaveLength(0);
  });

  it('schedules the import for a known run', async () => {
    const [search] = await db
      .insert(searches)
      .values({ term: 'barbearia', location: 'Campinas', maxResults: 30, apifyRunId: 'run1' })
      .returning();
    const response = await call('segredo-webhook', {
      eventType: 'ACTOR.RUN.SUCCEEDED',
      eventData: { actorRunId: 'run1' },
    });
    expect(response.status).toBe(200);
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    const [updated] = await db.select().from(searches).where(eq(searches.id, search.id));
    expect(updated.status).toBe('imported');
  });
});

describe('photos', () => {
  it('authorizes and removes Google photos', async () => {
    const { site } = await importFixture();
    const url = site.photos[0].url;

    await setPhotoAuthorized(site.id, url, true);
    let [saved] = await db.select().from(sites).where(eq(sites.id, site.id));
    expect(saved.photos[0].authorized).toBe(true);

    await removePhoto(site.id, url);
    [saved] = await db.select().from(sites).where(eq(sites.id, site.id));
    expect(saved.photos.map((p) => p.url)).not.toContain(url);
    expect(blobDel).not.toHaveBeenCalled();
  });

  it('uploads a photo as authorized and deletes it from Blob on removal', async () => {
    const { site } = await importFixture();
    const file = new File([new Uint8Array([1, 2, 3])], 'fachada.jpg', { type: 'image/jpeg' });

    const result = await addUploadedPhoto(site.id, file);
    expect(result).toEqual({ ok: true, message: 'Foto enviada.' });
    let [saved] = await db.select().from(sites).where(eq(sites.id, site.id));
    const uploaded = saved.photos.at(-1)!;
    expect(uploaded).toMatchObject({ source: 'upload', authorized: true });
    expect(uploaded.url).toMatch(/^https:\/\/blob\.example\/sites\//);

    await removePhoto(site.id, uploaded.url);
    expect(blobDel).toHaveBeenCalledWith(uploaded.url);
    [saved] = await db.select().from(sites).where(eq(sites.id, site.id));
    expect(saved.photos.some((p) => p.url === uploaded.url)).toBe(false);
  });

  it('refuses an invalid upload', async () => {
    const { site } = await importFixture();
    const gif = new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' });
    expect((await addUploadedPhoto(site.id, gif))?.ok).toBe(false);
    expect(blobPut).not.toHaveBeenCalled();
  });
});

describe('businesses', () => {
  it('saves edited site content within the limits', async () => {
    const { site } = await importFixture();
    const result = await updateSiteContent(site.id, { ...site.content, heroTitle: 'Novo título' }, 'fitness');
    expect(result.ok).toBe(true);
    const [saved] = await db.select().from(sites).where(eq(sites.id, site.id));
    expect(saved.content.heroTitle).toBe('Novo título');
    expect(saved.niche).toBe('fitness');
    expect((await updateSiteContent(site.id, { heroTitle: 'x' }, 'fitness')).ok).toBe(false);
  });

  it('marking "não contatar" blocks the phone and cancels scheduled messages', async () => {
    const { business } = await importFixture();
    await db.insert(messages).values({
      businessId: business.id,
      direction: 'out',
      kind: 'primeiro_contato',
      body: 'Oi',
      status: 'agendada',
    });
    await updateBusinessStatus(business.id, 'nao_contatar');
    const [saved] = await db.select().from(businesses).where(eq(businesses.id, business.id));
    expect(saved.status).toBe('nao_contatar');
    expect(await db.select().from(blockedPhones)).toHaveLength(1);
    const [message] = await db.select().from(messages).where(eq(messages.businessId, business.id));
    expect(message.status).toBe('cancelada');
  });

  it('deleteBusiness removes the site, messages and events', async () => {
    const { business } = await importFixture();
    await db.insert(messages).values({ businessId: business.id, direction: 'in', kind: 'recebida', body: 'Oi', status: 'recebida' });
    await db.insert(events).values({ type: 'teste', message: 'x', businessId: business.id });
    await deleteBusiness(business.id);
    expect(await db.select().from(businesses).where(eq(businesses.id, business.id))).toHaveLength(0);
    expect(await db.select().from(sites).where(eq(sites.businessId, business.id))).toHaveLength(0);
    expect(await db.select().from(messages).where(eq(messages.businessId, business.id))).toHaveLength(0);
    expect(await db.select().from(events).where(eq(events.businessId, business.id))).toHaveLength(0);
  });

  it('lists businesses with their preview slug and counts statuses', async () => {
    await importFixture();
    const rows = await listBusinesses({ status: 'previa_pronta' });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.slug)).toBe(true);
    expect((await listBusinesses({ q: 'padaria' })).map((r) => r.name)).toEqual(['Padaria Pão Quente']);
    const counts = await countByStatus();
    expect(counts.previa_pronta).toBe(3);
    expect(counts.cliente).toBe(0);
  });
});
