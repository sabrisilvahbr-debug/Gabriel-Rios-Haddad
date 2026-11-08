import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTEGRATIONS, appUrl, env, integrationStatus, MissingEnvError } from '@/lib/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearIntegrationVars() {
  for (const group of INTEGRATIONS) {
    for (const name of group.vars) vi.stubEnv(name, '');
  }
}

describe('integrationStatus', () => {
  it('marks group missing', () => {
    clearIntegrationVars();
    vi.stubEnv('DATABASE_URL', 'postgres://x');

    const status = integrationStatus();
    const banco = status.find((s) => s.key === 'banco');
    const apify = status.find((s) => s.key === 'apify');

    expect(banco?.ok).toBe(true);
    expect(apify?.ok).toBe(false);
    expect(apify?.missing).toContain('APIFY_TOKEN');
  });
});

describe('appUrl', () => {
  it('strips trailing slash', () => {
    vi.stubEnv('APP_URL', 'https://x.vercel.app/');
    expect(appUrl()).toBe('https://x.vercel.app');
  });

  it('falls back to the Vercel production URL', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'zap.vercel.app');
    expect(appUrl()).toBe('https://zap.vercel.app');
  });
});

describe('env', () => {
  it('throws a Portuguese error when the variable is missing', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(() => env('GEMINI_API_KEY')).toThrow(MissingEnvError);
    expect(() => env('GEMINI_API_KEY')).toThrow(/Configure a variável de ambiente GEMINI_API_KEY/);
  });
});
