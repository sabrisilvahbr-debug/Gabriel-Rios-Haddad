import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { GITHUB_OIDC_AUDIENCE, GITHUB_OIDC_ISSUER, verifyGithubActionsToken } from '@/lib/auth/github-oidc';

const REPO = 'sabrisilvahbr-debug/Gabriel-Rios-Haddad';
let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }] });
});

function token(
  claims: Record<string, unknown> = {},
  options: { audience?: string; issuer?: string; expiresAt?: number } = {},
): Promise<string> {
  return new SignJWT({ repository: REPO, ref: 'refs/heads/main', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(options.issuer ?? GITHUB_OIDC_ISSUER)
    .setAudience(options.audience ?? GITHUB_OIDC_AUDIENCE)
    .setSubject(`repo:${REPO}:ref:refs/heads/main`)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 300)
    .sign(privateKey);
}

describe('verifyGithubActionsToken', () => {
  it("accepts a token from this repository's main branch", async () => {
    expect(await verifyGithubActionsToken(await token(), { repository: REPO, keys })).toBe(true);
  });

  it('ignores letter case in the repository name', async () => {
    expect(await verifyGithubActionsToken(await token(), { repository: REPO.toLowerCase(), keys })).toBe(true);
  });

  it('rejects tokens from another repository', async () => {
    const other = await token({ repository: 'alguem/outro-repo' });
    expect(await verifyGithubActionsToken(other, { repository: REPO, keys })).toBe(false);
  });

  it('rejects tokens from other branches', async () => {
    const branch = await token({ ref: 'refs/heads/teste' });
    expect(await verifyGithubActionsToken(branch, { repository: REPO, keys })).toBe(false);
  });

  it('rejects the wrong audience or issuer', async () => {
    expect(await verifyGithubActionsToken(await token({}, { audience: 'outro' }), { repository: REPO, keys })).toBe(false);
    expect(
      await verifyGithubActionsToken(await token({}, { issuer: 'https://exemplo.com' }), { repository: REPO, keys }),
    ).toBe(false);
  });

  it('rejects expired and malformed tokens', async () => {
    const expired = await token({}, { expiresAt: Math.floor(Date.now() / 1000) - 120 });
    expect(await verifyGithubActionsToken(expired, { repository: REPO, keys })).toBe(false);
    expect(await verifyGithubActionsToken('nao-e-um-token', { repository: REPO, keys })).toBe(false);
    expect(await verifyGithubActionsToken('', { repository: REPO, keys })).toBe(false);
  });
});
