import { env, optionalEnv } from '@/lib/env';
import { isApexDomain } from './normalize';

const API = 'https://api.vercel.com';

export class VercelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VercelError';
  }
}

function projectId(): string {
  return env('VERCEL_PROJECT_ID');
}

function url(path: string): string {
  const team = optionalEnv('VERCEL_TEAM_ID');
  if (!team) return `${API}${path}`;
  return `${API}${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}`;
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url(path), {
    ...init,
    headers: { authorization: `Bearer ${env('VERCEL_API_TOKEN')}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
}

async function errorOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `HTTP ${response.status}`;
}

const domainPath = (name: string) => `/v9/projects/${projectId()}/domains/${encodeURIComponent(name)}`;

export async function addProjectDomain(name: string, redirect?: string): Promise<void> {
  const response = await call(`/v10/projects/${projectId()}/domains`, {
    method: 'POST',
    body: JSON.stringify(redirect ? { name, redirect, redirectStatusCode: 308 } : { name }),
  });
  if (response.ok) return;
  if (response.status === 409 && (await call(domainPath(name))).ok) return; // já é deste projeto
  throw new VercelError(await errorOf(response));
}

export async function removeProjectDomain(name: string): Promise<void> {
  const response = await call(domainPath(name), { method: 'DELETE' });
  if (response.ok || response.status === 404) return;
  throw new VercelError(await errorOf(response));
}

/** Remove o domínio e, se for a raiz, também o www. */
export async function removeDomainHosts(domain: string): Promise<void> {
  await removeProjectDomain(domain);
  if (isApexDomain(domain)) await removeProjectDomain(`www.${domain}`);
}

export interface DomainStatusInfo {
  verified: boolean;
  verification: Array<{ type: string; domain: string; value: string }>;
  misconfigured: boolean;
  recommendedIPv4?: string;
  recommendedCNAME?: string;
}

function rankOne<T extends { rank?: number }>(list: T[] | undefined): T | undefined {
  return [...(list ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];
}

export async function getDomainStatus(name: string): Promise<DomainStatusInfo> {
  const [projectResponse, configResponse] = await Promise.all([
    call(domainPath(name)),
    call(`/v6/domains/${encodeURIComponent(name)}/config?projectIdOrName=${encodeURIComponent(projectId())}`),
  ]);
  if (!projectResponse.ok) throw new VercelError(await errorOf(projectResponse));
  if (!configResponse.ok) throw new VercelError(await errorOf(configResponse));

  const project = (await projectResponse.json()) as {
    verified?: boolean;
    verification?: Array<{ type: string; domain: string; value: string }>;
  };
  const config = (await configResponse.json()) as {
    misconfigured?: boolean;
    recommendedIPv4?: Array<{ rank?: number; value?: string[] }>;
    recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  };
  return {
    verified: project.verified ?? false,
    verification: project.verification ?? [],
    misconfigured: config.misconfigured ?? true,
    recommendedIPv4: rankOne(config.recommendedIPv4)?.value?.[0],
    recommendedCNAME: rankOne(config.recommendedCNAME)?.value,
  };
}

export async function verifyProjectDomain(name: string): Promise<void> {
  const response = await call(`${domainPath(name)}/verify`, { method: 'POST' });
  if (!response.ok) throw new VercelError(await errorOf(response));
}
