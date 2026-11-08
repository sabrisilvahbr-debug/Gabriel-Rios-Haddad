'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { refreshSearch, startSearch } from '@/lib/apify/import';
import { errorMessage } from '@/lib/async';
import { requireSession } from '@/lib/auth/session';
import { isConfigured } from '@/lib/env';

export async function startSearchAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();
  if (!isConfigured('apify')) return fail('Configure APIFY_TOKEN e APIFY_WEBHOOK_SECRET antes de buscar.');
  try {
    const search = await startSearch({
      term: String(formData.get('term') ?? ''),
      location: String(formData.get('location') ?? ''),
      maxResults: Number(formData.get('maxResults') ?? 30),
    });
    revalidatePath('/painel/buscas');
    if (search.status === 'failed') return fail(`A busca não começou: ${search.error}`);
    return ok('Busca iniciada. Em alguns minutos as empresas e as prévias aparecem aqui.');
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function refreshSearchAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    const search = await refreshSearch(String(formData.get('id') ?? ''));
    revalidatePath('/painel/buscas');
    revalidatePath('/painel/empresas');
    if (search.status === 'imported') return ok(`${search.importedCount} empresa(s) importada(s).`);
    if (search.status === 'failed') return fail(search.error ?? 'A busca falhou.');
    return ok('Ainda buscando. Tente de novo em instantes.');
  } catch (error) {
    return fail(errorMessage(error));
  }
}
