'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { errorMessage } from '@/lib/async';
import { requireSession } from '@/lib/auth/session';
import { deleteBusiness, setAiPaused, updateBusinessStatus, updateNotes } from '@/lib/businesses';
import type { BusinessStatus, Niche } from '@/lib/constants';
import { parseContentForm } from '@/lib/sites/content-form';
import { addUploadedPhoto, removePhoto, setPhotoAuthorized } from '@/lib/sites/photos';
import { checkDomain, connectDomain, disconnectDomain, publishSite, unpublishSite } from '@/lib/sites/publish';
import { regenerateSiteContent, updateSiteContent } from '@/lib/sites/service';
import { registerInboundMessage, suggestReply, type Suggestion } from '@/lib/whatsapp/manual';
import { cancelQueued, enqueueFirstContact, sendManualMessage } from '@/lib/whatsapp/outreach';

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

export async function connectDomainAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await connectDomain(str(data, 'siteId'), str(data, 'domain'));
  refresh(data);
  return result;
}

export async function checkDomainAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const status = await checkDomain(str(data, 'siteId'));
  refresh(data);
  if (status === 'ativo') return ok('Domínio funcionando. Já dá para publicar.');
  if (status === 'erro') return fail('Não consegui consultar a Vercel. Veja o erro abaixo.');
  return fail('Ainda não está pronto. O DNS pode levar algumas horas para atualizar.');
}

export async function publishAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await publishSite(str(data, 'siteId'));
  refresh(data);
  return result;
}

export async function unpublishAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await unpublishSite(str(data, 'siteId'));
  refresh(data);
  return result;
}

export async function disconnectDomainAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await disconnectDomain(str(data, 'siteId'));
  refresh(data);
  return result;
}

export async function enqueueOneAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await enqueueFirstContact(str(data, 'businessId'));
  refresh(data);
  return result;
}

export async function cancelQueueOneAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  await cancelQueued(str(data, 'businessId'));
  refresh(data);
  return ok('Envio cancelado.');
}

export async function sendManualAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await sendManualMessage(str(data, 'businessId'), str(data, 'text'));
  refresh(data);
  return result;
}

export async function toggleAiAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const paused = str(data, 'paused') === 'true';
  await setAiPaused(str(data, 'businessId'), paused);
  refresh(data);
  return ok(paused ? 'IA pausada nesta conversa.' : 'IA retomada nesta conversa.');
}

/** Modo celular: a dona cola a mensagem que a empresa mandou no WhatsApp. */
export async function registerReplyAction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  await requireSession();
  const result = await registerInboundMessage(str(data, 'businessId'), str(data, 'text'), new Date());
  refresh(data);
  return result.ok ? ok(result.message) : fail(result.message);
}

/** Modo celular: a IA sugere a próxima resposta (quem envia é a dona). */
export async function suggestReplyAction(businessId: string): Promise<Suggestion> {
  await requireSession();
  const result = await suggestReply(businessId);
  revalidatePath(`/painel/empresas/${businessId}`);
  return result;
}
