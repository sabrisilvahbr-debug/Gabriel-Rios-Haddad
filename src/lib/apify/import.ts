import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { errorMessage, mapWithConcurrency } from '@/lib/async';
import { isBlocked } from '@/lib/blocklist';
import { MAX_RESULTS_LIMIT } from '@/lib/constants';
import { getDb } from '@/lib/db/client';
import { businesses, searches, sites, type Search } from '@/lib/db/schema';
import { getSettings } from '@/lib/db/settings';
import { appUrl, env } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { createSiteForBusiness } from '@/lib/sites/service';
import { getDatasetItems, getRun, startGoogleMapsRun } from './client';
import { mapPlace } from './mapper';

const FAILED_RUN_STATUSES = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT']);

export async function listSearches(limit = 30): Promise<Search[]> {
  return getDb().select().from(searches).orderBy(desc(searches.createdAt)).limit(limit);
}

export async function getSearch(id: string): Promise<Search | null> {
  const [row] = await getDb().select().from(searches).where(eq(searches.id, id)).limit(1);
  return row ?? null;
}

async function markFailed(id: string, error: string): Promise<Search> {
  const [row] = await getDb()
    .update(searches)
    .set({ status: 'failed', error, finishedAt: new Date() })
    .where(eq(searches.id, id))
    .returning();
  return row;
}

export async function startSearch(input: { term: string; location: string; maxResults: number }): Promise<Search> {
  const term = input.term.trim();
  const location = input.location.trim();
  if (!term || !location) throw new Error('Informe o ramo e a cidade.');
  const maxResults = Math.min(Math.max(Math.round(input.maxResults) || 1, 1), MAX_RESULTS_LIMIT);

  const [search] = await getDb().insert(searches).values({ term, location, maxResults }).returning();
  try {
    const webhookUrl = `${appUrl()}/api/webhooks/apify?token=${encodeURIComponent(env('APIFY_WEBHOOK_SECRET'))}`;
    const run = await startGoogleMapsRun({ term, location, maxResults, webhookUrl });
    const [updated] = await getDb()
      .update(searches)
      .set({ apifyRunId: run.runId, apifyDatasetId: run.datasetId })
      .where(eq(searches.id, search.id))
      .returning();
    await logEvent('busca_iniciada', `Busca iniciada: ${term} em ${location}.`);
    return updated;
  } catch (error) {
    await logEvent('erro', `A busca "${term}" não começou: ${errorMessage(error)}`);
    return markFailed(search.id, errorMessage(error));
  }
}

/** Baixa o resultado do Apify, filtra e cria empresas + prévias. Repetir não duplica nada. */
export async function importSearchResults(
  searchId: string,
): Promise<{ found: number; imported: number; skipped: number }> {
  const search = await getSearch(searchId);
  if (!search) throw new Error('Busca não encontrada.');
  if (search.status === 'imported') {
    return { found: search.foundCount, imported: search.importedCount, skipped: search.skippedCount };
  }

  let datasetId = search.apifyDatasetId;
  if (!datasetId && search.apifyRunId) datasetId = (await getRun(search.apifyRunId)).datasetId;
  if (!datasetId) throw new Error('A busca ainda não tem resultado no Apify.');

  const items = await getDatasetItems(datasetId);
  const settings = await getSettings();
  const db = getDb();

  for (const item of items) {
    const mapped = mapPlace(item, { includeLandlines: settings.includeLandlines });
    if (!mapped.ok || (await isBlocked(mapped.place.phone.e164))) continue;
    const p = mapped.place;
    // O Google às vezes lista o mesmo dono duas vezes: um telefone, uma empresa (e uma mensagem só).
    const [samePhone] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.phoneE164, p.phone.e164))
      .limit(1);
    if (samePhone) continue;
    await db
      .insert(businesses)
      .values({
        searchId,
        placeId: p.placeId,
        name: p.name,
        category: p.category,
        niche: p.niche,
        address: p.address,
        neighborhood: p.neighborhood,
        city: p.city,
        state: p.state,
        phoneDisplay: p.phone.display,
        phoneE164: p.phone.e164,
        phoneIsMobile: p.phone.isMobile,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        mapsUrl: p.mapsUrl,
        openingHours: p.openingHours,
        imageUrls: p.imageUrls,
        description: p.description,
      })
      .onConflictDoNothing({ target: businesses.placeId });
  }

  // Cria as prévias que faltam nesta busca, inclusive as de uma importação interrompida.
  const withoutSite = await db
    .select({ id: businesses.id })
    .from(businesses)
    .leftJoin(sites, eq(sites.businessId, businesses.id))
    .where(and(eq(businesses.searchId, searchId), isNull(sites.id)));
  await mapWithConcurrency(withoutSite.map((b) => b.id), 3, async (id) => {
    try {
      await createSiteForBusiness(id);
    } catch (error) {
      await logEvent('erro', `Não consegui criar a prévia: ${errorMessage(error)}`, id);
    }
  });

  const [{ imported }] = await db
    .select({ imported: sql<number>`count(*)::int` })
    .from(businesses)
    .where(eq(businesses.searchId, searchId));
  const skipped = Math.max(items.length - imported, 0);
  await db
    .update(searches)
    .set({
      status: 'imported',
      apifyDatasetId: datasetId,
      foundCount: items.length,
      importedCount: imported,
      skippedCount: skipped,
      error: null,
      finishedAt: new Date(),
    })
    .where(and(eq(searches.id, searchId), ne(searches.status, 'imported')));
  await logEvent(
    'busca_importada',
    `${imported} empresa(s) nova(s) em "${search.term}" (${search.location}); ${skipped} ignorada(s).`,
  );
  return { found: items.length, imported, skipped };
}

/** Botão "Atualizar": consulta o Apify e importa se a busca terminou. */
export async function refreshSearch(searchId: string): Promise<Search> {
  const search = await getSearch(searchId);
  if (!search) throw new Error('Busca não encontrada.');
  if (search.status === 'imported' || search.status === 'failed' || !search.apifyRunId) return search;

  const run = await getRun(search.apifyRunId);
  if (run.status === 'SUCCEEDED') {
    await getDb()
      .update(searches)
      .set({ status: 'succeeded', apifyDatasetId: run.datasetId })
      .where(and(eq(searches.id, searchId), ne(searches.status, 'imported')));
    try {
      await importSearchResults(searchId);
    } catch (error) {
      return markFailed(searchId, errorMessage(error));
    }
  } else if (FAILED_RUN_STATUSES.has(run.status)) {
    return markFailed(searchId, `A busca no Apify terminou com status ${run.status}.`);
  }
  return (await getSearch(searchId)) ?? search;
}

interface ApifyWebhookPayload {
  eventType?: string;
  eventData?: { actorRunId?: string };
  resource?: { id?: string; status?: string; defaultDatasetId?: string };
}

/** Chamado pelo webhook do Apify (já autenticado). */
export async function processApifyWebhook(payload: unknown): Promise<void> {
  const data = (payload ?? {}) as ApifyWebhookPayload;
  const runId = data.eventData?.actorRunId ?? data.resource?.id;
  if (!runId) return;
  const [search] = await getDb().select().from(searches).where(eq(searches.apifyRunId, runId)).limit(1);
  if (!search) return;
  await refreshSearch(search.id);
}
