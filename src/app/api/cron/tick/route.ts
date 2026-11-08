import { verifyGithubActionsToken } from '@/lib/auth/github-oidc';
import { safeEqual } from '@/lib/auth/session';
import { runTick } from '@/lib/cron/tick';
import { optionalEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
// Respostas da IA podem demorar; a trava da rodada (LOCK_MS em lib/cron/tick.ts) dura mais que isso.
export const maxDuration = 300;

/** Quem chama: a Vercel Cron (Bearer CRON_SECRET) ou o agendador do GitHub Actions (token assinado do GitHub). */
async function authorized(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? '';
  const secret = optionalEnv('CRON_SECRET');
  if (secret && safeEqual(auth, `Bearer ${secret}`)) return true;

  const repository = optionalEnv('CRON_GITHUB_REPOSITORY');
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  return Boolean(repository && token && (await verifyGithubActionsToken(token, { repository })));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }
  return Response.json(await runTick(new Date()));
}
