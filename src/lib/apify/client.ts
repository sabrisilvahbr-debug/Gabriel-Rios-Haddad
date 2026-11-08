import { MAX_RESULTS_LIMIT } from '@/lib/constants';
import { env, optionalEnv } from '@/lib/env';

const API = 'https://api.apify.com/v2';
export const DEFAULT_APIFY_ACTOR = 'compass~crawler-google-places';

export class ApifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApifyError';
  }
}

function actorId(): string {
  return optionalEnv('APIFY_ACTOR') ?? DEFAULT_APIFY_ACTOR;
}

async function apifyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env('APIFY_TOKEN')}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApifyError(`Apify respondeu ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export function buildActorInput(term: string, location: string, maxResults: number) {
  const place = /\bbrasil\b|\bbrazil\b/i.test(location) ? location : `${location}, Brasil`;
  return {
    searchStringsArray: [term],
    locationQuery: place,
    maxCrawledPlacesPerSearch: Math.min(Math.max(Math.round(maxResults), 1), MAX_RESULTS_LIMIT),
    language: 'pt-BR',
    countryCode: 'br',
    website: 'withoutWebsite',
    skipClosedPlaces: true,
    scrapePlaceDetailPage: true,
    maxImages: 6,
    maxReviews: 0,
  };
}

interface RunResponse {
  data: { id: string; status: string; defaultDatasetId: string };
}

export async function startGoogleMapsRun(input: {
  term: string;
  location: string;
  maxResults: number;
  webhookUrl: string;
}): Promise<{ runId: string; datasetId: string }> {
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.ABORTED', 'ACTOR.RUN.TIMED_OUT'],
        requestUrl: input.webhookUrl,
      },
    ]),
  ).toString('base64');

  const { data } = await apifyFetch<RunResponse>(
    `/acts/${actorId()}/runs?webhooks=${encodeURIComponent(webhooks)}`,
    { method: 'POST', body: JSON.stringify(buildActorInput(input.term, input.location, input.maxResults)) },
  );
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

export async function getRun(runId: string): Promise<{ status: string; datasetId: string }> {
  const { data } = await apifyFetch<RunResponse>(`/actor-runs/${encodeURIComponent(runId)}`);
  return { status: data.status, datasetId: data.defaultDatasetId };
}

export async function getDatasetItems(datasetId: string): Promise<unknown[]> {
  const items = await apifyFetch<unknown>(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`);
  return Array.isArray(items) ? items : [];
}
