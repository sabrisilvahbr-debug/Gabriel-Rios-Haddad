import { after } from 'next/server';
import { processApifyWebhook } from '@/lib/apify/import';
import { errorMessage } from '@/lib/async';
import { safeEqual } from '@/lib/auth/session';
import { optionalEnv } from '@/lib/env';

export const maxDuration = 300;

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const secret = optionalEnv('APIFY_WEBHOOK_SECRET');
  if (!secret || !safeEqual(token, secret)) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  after(async () => {
    try {
      await processApifyWebhook(payload);
    } catch (error) {
      console.error('[apify-webhook] falha ao importar:', errorMessage(error));
    }
  });
  return Response.json({ ok: true });
}
