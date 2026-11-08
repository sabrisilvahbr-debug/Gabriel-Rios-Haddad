import { safeEqual } from '@/lib/auth/session';
import { runTick } from '@/lib/cron/tick';
import { optionalEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Chamado pela Vercel Cron a cada minuto, com Authorization: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  const secret = optionalEnv('CRON_SECRET');
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }
  return Response.json(await runTick(new Date()));
}
