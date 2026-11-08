'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { requireSession } from '@/lib/auth/session';
import { getSettings } from '@/lib/db/settings';
import { enqueueAllReady } from '@/lib/whatsapp/outreach';

export async function enqueueReadyAction(): Promise<ActionResult> {
  await requireSession();
  const settings = await getSettings();
  if (!settings.agencyName) return fail('Coloque o nome da sua agência em Configurações antes de enviar.');
  const queued = await enqueueAllReady();
  revalidatePath('/painel/empresas');
  if (!queued) return fail('Nenhuma prévia pronta com celular para colocar na fila.');
  const note = settings.outreachEnabled ? '' : ' O envio automático está desligado em Configurações.';
  return ok(`${queued} empresa(s) na fila.${note}`);
}
