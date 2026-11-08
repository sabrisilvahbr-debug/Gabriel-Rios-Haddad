import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { GET as cronTick } from '@/app/api/cron/tick/route';
import { GITHUB_OIDC_AUDIENCE, GITHUB_OIDC_ISSUER } from '@/lib/auth/github-oidc';

const REPO = 'sabrisilvahbr-debug/Gabriel-Rios-Haddad';
let privateKey: CryptoKey;
let jwks: { keys: unknown[] };

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'gh', alg: 'RS256', use: 'sig' }] };
});

beforeEach(async () => {
  await createTestDb();
  vi.stubEnv('CRON_SECRET', '');
  vi.stubEnv('CRON_GITHUB_REPOSITORY', REPO);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) =>
      String(url) === `${GITHUB_OIDC_ISSUER}/.well-known/jwks`
        ? new Response(JSON.stringify(jwks), { headers: { 'content-type': 'application/json' } })
        : new Response('{}', { status: 404 }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function githubToken(repository = REPO): Promise<string> {
  return new SignJWT({ repository, ref: 'refs/heads/main' })
    .setProtectedHeader({ alg: 'RS256', kid: 'gh' })
    .setIssuer(GITHUB_OIDC_ISSUER)
    .setAudience(GITHUB_OIDC_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

const call = (token: string) =>
  cronTick(new Request('https://zap.vercel.app/api/cron/tick', { headers: { authorization: `Bearer ${token}` } }));

describe('cron route with the GitHub Actions scheduler', () => {
  it('runs a tick for a token from the configured repository', async () => {
    expect((await call(await githubToken())).status).toBe(200);
  });

  it('refuses tokens from other repositories and random strings', async () => {
    expect((await call(await githubToken('alguem/outro-repo'))).status).toBe(401);
    expect((await call('qualquer-coisa')).status).toBe(401);
  });

  it('ignores GitHub tokens when no repository is configured', async () => {
    vi.stubEnv('CRON_GITHUB_REPOSITORY', '');
    expect((await call(await githubToken())).status).toBe(401);
  });
});
