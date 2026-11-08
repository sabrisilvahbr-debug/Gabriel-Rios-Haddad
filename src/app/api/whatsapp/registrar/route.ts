import { z } from 'zod';
import { requestHasSession } from '@/lib/auth/session';
import { markQueuedMessageSent, recordManualSend } from '@/lib/whatsapp/manual';

export const dynamic = 'force-dynamic';

const bodySchema = z.union([
  z.object({ messageId: z.uuid() }),
  z.object({ businessId: z.uuid(), text: z.string().min(1).max(4000), kind: z.enum(['manual', 'ia']) }),
]);

/** Modo celular: o painel avisa (por sendBeacon) que a dona abriu o WhatsApp para enviar uma mensagem. */
export async function POST(request: Request) {
  if (!(await requestHasSession(request))) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'pedido inválido' }, { status: 400 });

  const now = new Date();
  const result =
    'messageId' in parsed.data
      ? await markQueuedMessageSent(parsed.data.messageId, now)
      : await recordManualSend(parsed.data.businessId, parsed.data.text, parsed.data.kind, now);
  return Response.json(result);
}
