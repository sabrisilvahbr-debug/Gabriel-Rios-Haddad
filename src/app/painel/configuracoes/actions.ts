'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { requireSession } from '@/lib/auth/session';
import { updateSettings } from '@/lib/db/settings';
import { parseSettingsForm } from '@/lib/settings-form';

export async function saveSettingsAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const parsed = parseSettingsForm(data);
  if (!parsed.ok) return fail(parsed.message);
  await updateSettings(parsed.patch);
  revalidatePath('/painel', 'layout');
  return ok('Configurações salvas.');
}
