import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { env, optionalEnv } from '@/lib/env';

export const SESSION_COOKIE = 'zbf_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env('SESSION_SECRET'));
}

/** Compara dois textos em tempo constante (também quando o tamanho difere). */
export function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB) && a.length === b.length;
}

export function checkPassword(input: string): boolean {
  const expected = optionalEnv('ADMIN_PASSWORD');
  if (!expected || !input) return false;
  return safeEqual(input, expected);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !optionalEnv('SESSION_SECRET')) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload.sub === 'admin';
  } catch {
    return false;
  }
}

/** Para rotas de API do painel: diz se há sessão válida, sem redirecionar. */
export async function hasSession(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Para rotas chamadas pelo próprio painel (ex.: navigator.sendBeacon): lê o cookie direto do pedido. */
export async function requestHasSession(request: Request): Promise<boolean> {
  const cookies = request.headers.get('cookie') ?? '';
  const token = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifySessionToken(token);
}

/** Para páginas e server actions do painel: sem sessão, vai para o login. */
export async function requireSession(): Promise<void> {
  if (await hasSession()) return;
  const { redirect } = await import('next/navigation');
  redirect('/login');
}
