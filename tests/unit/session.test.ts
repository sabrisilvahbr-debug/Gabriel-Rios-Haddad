import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPassword, createSessionToken, safeEqual, verifySessionToken } from '@/lib/auth/session';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session token', () => {
  it('verifies a token it created', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(40));
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it('rejects a token signed with another secret', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(40));
    const token = await createSessionToken();
    vi.stubEnv('SESSION_SECRET', 'b'.repeat(40));
    expect(await verifySessionToken(token)).toBe(false);
  });

  it('rejects missing and malformed tokens', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(40));
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken('abc.def.ghi')).toBe(false);
  });
});

describe('checkPassword', () => {
  it('accepts only the configured password', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'segredo-forte');
    expect(checkPassword('segredo-forte')).toBe(true);
    expect(checkPassword('segredo-fraco')).toBe(false);
    expect(checkPassword('')).toBe(false);
  });

  it('refuses every password when none is configured', () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(checkPassword('')).toBe(false);
    expect(checkPassword('qualquer')).toBe(false);
  });
});

describe('safeEqual', () => {
  it('compares strings of different lengths without throwing', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
