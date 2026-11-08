import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * O agendador grátis roda no GitHub Actions e se identifica com o token assinado pelo próprio GitHub
 * (OIDC). Assim o repositório público não precisa guardar nenhum segredo.
 */
export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITHUB_OIDC_AUDIENCE = 'zap-business-flow';
const MAIN_REF = 'refs/heads/main';

let githubKeys: JWTVerifyGetKey | null = null;

function defaultKeys(): JWTVerifyGetKey {
  githubKeys ??= createRemoteJWKSet(new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`));
  return githubKeys;
}

/** Diz se o token veio de um workflow do branch main do repositório informado. */
export async function verifyGithubActionsToken(
  token: string,
  options: { repository: string; keys?: JWTVerifyGetKey },
): Promise<boolean> {
  if (!token || !options.repository) return false;
  try {
    const { payload } = await jwtVerify(token, options.keys ?? defaultKeys(), {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
    });
    const repository = typeof payload.repository === 'string' ? payload.repository.toLowerCase() : '';
    return repository === options.repository.trim().toLowerCase() && payload.ref === MAIN_REF;
  } catch {
    return false;
  }
}
