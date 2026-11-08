import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as { __zbfDb?: unknown }).__zbfDb;
});

describe('getDb', () => {
  it('shares one database per process even when Next.js loads the module in two bundles', async () => {
    vi.stubEnv('DATABASE_URL', 'pglite:memory');
    vi.resetModules();
    const first = (await import('@/lib/db/client')).getDb();
    vi.resetModules();
    const second = (await import('@/lib/db/client')).getDb();
    expect(second).toBe(first);
  });
});
