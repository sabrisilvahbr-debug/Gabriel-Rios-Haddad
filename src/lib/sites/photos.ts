import { del, put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import type { ActionResult } from '@/lib/action-result';
import { errorMessage } from '@/lib/async';
import { getDb } from '@/lib/db/client';
import { sites } from '@/lib/db/schema';
import type { SitePhoto } from '@/lib/types';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_SITE = 12;

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES[file.type]) return 'Envie uma foto em JPG, PNG ou WebP.';
  if (file.size <= 0) return 'O arquivo está vazio.';
  if (file.size > MAX_UPLOAD_BYTES) return 'A foto pode ter no máximo 5 MB.';
  return null;
}

async function getPhotos(siteId: string): Promise<SitePhoto[]> {
  const [site] = await getDb().select({ photos: sites.photos }).from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new Error('Site não encontrado.');
  return site.photos;
}

async function savePhotos(siteId: string, photos: SitePhoto[]): Promise<void> {
  await getDb().update(sites).set({ photos, updatedAt: new Date() }).where(eq(sites.id, siteId));
}

export async function setPhotoAuthorized(siteId: string, url: string, authorized: boolean): Promise<void> {
  const photos = await getPhotos(siteId);
  await savePhotos(
    siteId,
    photos.map((p) => (p.url === url ? { ...p, authorized } : p)),
  );
}

export async function removePhoto(siteId: string, url: string): Promise<void> {
  const photos = await getPhotos(siteId);
  const photo = photos.find((p) => p.url === url);
  await savePhotos(
    siteId,
    photos.filter((p) => p.url !== url),
  );
  if (photo?.source === 'upload') {
    try {
      await del(url);
    } catch (error) {
      console.warn('[photos] não consegui apagar do Blob:', errorMessage(error));
    }
  }
}

/** Foto enviada pela dona do sistema (vinda da empresa): já entra autorizada. */
export async function addUploadedPhoto(siteId: string, file: File): Promise<ActionResult> {
  const invalid = validateUpload(file);
  if (invalid) return { ok: false, message: invalid };
  const photos = await getPhotos(siteId);
  if (photos.length >= MAX_PHOTOS_PER_SITE) {
    return { ok: false, message: `Cada site pode ter até ${MAX_PHOTOS_PER_SITE} fotos. Remova uma antes.` };
  }
  try {
    const blob = await put(`sites/${siteId}/${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`, file, {
      access: 'public',
      contentType: file.type,
    });
    await savePhotos(siteId, [...photos, { url: blob.url, credit: '', source: 'upload', authorized: true }]);
    return { ok: true, message: 'Foto enviada.' };
  } catch (error) {
    return { ok: false, message: `Não consegui enviar a foto: ${errorMessage(error)}` };
  }
}
