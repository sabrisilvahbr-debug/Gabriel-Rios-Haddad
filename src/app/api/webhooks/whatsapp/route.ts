import { errorMessage } from '@/lib/async';
import { safeEqual } from '@/lib/auth/session';
import { optionalEnv } from '@/lib/env';
import { handleEvolutionEvent } from '@/lib/whatsapp/inbound';
import { parseEvolutionEvent } from '@/lib/whatsapp/webhook';

export const dynamic = 'force-dynamic';

/** Eventos da Evolution API (mensagens, conexão e QR code). */
export async function POST(request: Request) {
  const secret = optionalEnv('WHATSAPP_WEBHOOK_SECRET');
  const header = request.headers.get('x-webhook-secret') ?? '';
  if (!secret || !safeEqual(header, secret)) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json({ error: 'JSON inválido' }, { status: 400 });

  try {
    await handleEvolutionEvent(parseEvolutionEvent(payload), new Date());
  } catch (error) {
    console.error('[whatsapp-webhook]', errorMessage(error));
  }
  return Response.json({ ok: true });
}
