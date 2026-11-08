'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { errorMessage } from '@/lib/async';
import { requireSession } from '@/lib/auth/session';
import { disconnectWhatsapp, startConnection } from '@/lib/whatsapp/connection';
import { cancelQueued } from '@/lib/whatsapp/outreach';

export async function connectAction(): Promise<ActionResult> {
  await requireSession();
  return startConnection(new Date());
}

export async function disconnectAction(): Promise<ActionResult> {
  await requireSession();
  try {
    await disconnectWhatsapp();
    revalidatePath('/painel/whatsapp');
    return ok('WhatsApp desconectado.');
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function cancelQueuedAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  await cancelQueued(String(data.get('businessId') ?? ''));
  revalidatePath('/painel/whatsapp');
  return ok('Envio cancelado.');
}
