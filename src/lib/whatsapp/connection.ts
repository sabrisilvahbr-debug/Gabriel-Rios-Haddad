import { errorMessage } from '@/lib/async';
import { getAppState, updateAppState } from '@/lib/db/settings';
import { isConfigured } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { connect, connectionState, createInstance, logout, setWebhook, type ConnectionState } from './evolution';

const QR_MAX_AGE_MS = 25_000;

/** Botão "Conectar": prepara a instância e o webhook e devolve o primeiro QR code. */
export async function startConnection(now: Date = new Date()): Promise<{ ok: boolean; message: string }> {
  if (!isConfigured('whatsapp')) {
    return { ok: false, message: 'Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e WHATSAPP_WEBHOOK_SECRET.' };
  }
  try {
    await createInstance();
    await setWebhook();
    const state = await connectionState();
    if (state === 'open') {
      await updateAppState({ waConnectionState: 'open', waLastQr: null });
      return { ok: true, message: 'O WhatsApp já está conectado.' };
    }
    const { qrBase64 } = await connect();
    await updateAppState({ waConnectionState: state, waLastQr: qrBase64, waLastQrAt: now });
    return { ok: true, message: 'Abra o WhatsApp no celular e escaneie o QR code.' };
  } catch (error) {
    return { ok: false, message: `Não consegui falar com a Evolution API: ${errorMessage(error)}` };
  }
}

/** Consultado pela página a cada poucos segundos enquanto conecta. Renova o QR quando ele vence. */
export async function refreshConnection(now: Date = new Date()): Promise<{ state: ConnectionState; qr: string | null }> {
  const state = await connectionState();
  const app = await getAppState();
  if (state === 'open') {
    if (app.waConnectionState !== 'open') await logEvent('whatsapp', 'WhatsApp conectado.');
    await updateAppState({ waConnectionState: 'open', waLastQr: null });
    return { state, qr: null };
  }

  let qr = app.waLastQr;
  const stale = !app.waLastQrAt || now.getTime() - app.waLastQrAt.getTime() > QR_MAX_AGE_MS;
  if (!qr || stale) {
    qr = (await connect()).qrBase64;
    await updateAppState({ waConnectionState: state, waLastQr: qr, waLastQrAt: now });
  } else {
    await updateAppState({ waConnectionState: state });
  }
  return { state, qr };
}

export async function disconnectWhatsapp(): Promise<void> {
  await logout();
  await updateAppState({ waConnectionState: 'close', waLastQr: null });
  await logEvent('whatsapp', 'WhatsApp desconectado pelo painel.');
}
