'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { errorMessage } from '@/lib/async';
import { requireSession } from '@/lib/auth/session';
import { deleteBusiness, updateBusinessStatus, updateNotes } from '@/lib/businesses';
import type { BusinessStatus, Niche } from '@/lib/constants';
import { parseContentForm } from '@/lib/sites/content-form';
import { addUploadedPhoto, removePhoto, setPhotoAuthorized } from '@/lib/sites/photos';
import { regenerateSiteContent, updateSiteContent } from '@/lib/sites/service';

const str = (data: FormData, name: string) => String(data.get(name) ?? '');

function refresh(data: FormData) {
  revalidatePath(`/painel/empresas/${str(data, 'businessId')}`);
}

export async function saveContentAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const content = parseContentForm(data);
  if (!content) {
    return fail('Preencha título, subtítulo, texto sobre, botão, descrição para o Google, 3 serviços e 3 diferenciais.');
  }
  const result = await updateSiteContent(str(data, 'siteId'), content, str(data, 'niche') as Niche);
  refresh(data);
  return result;
}

export async function regenerateAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    const site = await regenerateSiteContent(str(data, 'siteId'));
    refresh(data);
    return site.generationSource === 'ia'
      ? ok('Textos novos gerados pela IA.')
      : fail('A IA não respondeu; mantive os textos padrão do ramo. Confira GEMINI_API_KEY.');
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function photoAuthorizeAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const authorized = str(data, 'authorized') === 'true';
  await setPhotoAuthorized(str(data, 'siteId'), str(data, 'url'), authorized);
  refresh(data);
  return ok(authorized ? 'Foto autorizada.' : 'Autorização removida.');
}

export async function photoRemoveAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  await removePhoto(str(data, 'siteId'), str(data, 'url'));
  refresh(data);
  return ok('Foto removida.');
}

export async function photoUploadAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const file = data.get('photo');
  if (!(file instanceof File) || file.size === 0) return fail('Escolha uma foto.');
  const result = await addUploadedPhoto(str(data, 'siteId'), file);
  refresh(data);
  return result;
}

export async function statusAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    await updateBusinessStatus(str(data, 'businessId'), str(data, 'status') as BusinessStatus);
    refresh(data);
    return ok('Etapa atualizada.');
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function notesAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  await updateNotes(str(data, 'businessId'), str(data, 'notes'));
  refresh(data);
  return ok('Anotações salvas.');
}

export async function deleteAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  await deleteBusiness(str(data, 'businessId'));
  revalidatePath('/painel/empresas');
  redirect('/painel/empresas');
}
