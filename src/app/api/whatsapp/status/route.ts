import { errorMessage } from '@/lib/async';
import { hasSession } from '@/lib/auth/session';
import { refreshConnection } from '@/lib/whatsapp/connection';

export const dynamic = 'force-dynamic';

/** Estado da conexão e QR code atual, consultado pela página do WhatsApp. */
export async function GET() {
  if (!(await hasSession())) return Response.json({ error: 'não autorizado' }, { status: 401 });
  try {
    return Response.json(await refreshConnection(new Date()));
  } catch (error) {
    return Response.json({ state: 'unknown', qr: null, error: errorMessage(error) }, { status: 502 });
  }
}
