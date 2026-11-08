import { appUrl, env, optionalEnv } from '@/lib/env';

/** Cliente da Evolution API v2 (WhatsApp por QR code), hospedada no Railway. */

export class EvolutionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EvolutionError';
    this.status = status;
  }
}

export type ConnectionState = 'open' | 'close' | 'connecting' | 'unknown';

function baseUrl(): string {
  return env('EVOLUTION_API_URL').replace(/\/+$/, '');
}

export function instanceName(): string {
  return optionalEnv('EVOLUTION_INSTANCE') ?? 'zapflow';
}

async function evo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { apikey: env('EVOLUTION_API_KEY'), 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new EvolutionError(`Evolution API respondeu ${response.status}: ${detail.slice(0, 300)}`, response.status);
  }
  return (await response.json().catch(() => ({}))) as T;
}

export function webhookConfig() {
  return {
    enabled: true,
    url: `${appUrl()}/api/webhooks/whatsapp`,
    byEvents: false,
    base64: false,
    headers: { 'x-webhook-secret': env('WHATSAPP_WEBHOOK_SECRET') },
    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
  };
}

/** Cria a instância (se já existir, segue em frente). */
export async function createInstance(): Promise<void> {
  try {
    await evo('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instanceName(),
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        groupsIgnore: true,
        webhook: webhookConfig(),
      }),
    });
  } catch (error) {
    if (error instanceof EvolutionError && (error.status === 403 || error.status === 409)) return;
    throw error;
  }
}

export async function setWebhook(): Promise<void> {
  await evo(`/webhook/set/${instanceName()}`, { method: 'POST', body: JSON.stringify({ webhook: webhookConfig() }) });
}

export async function connect(): Promise<{ qrBase64: string | null; pairingCode: string | null }> {
  const data = await evo<{ base64?: string; pairingCode?: string }>(`/instance/connect/${instanceName()}`);
  return { qrBase64: data.base64 ?? null, pairingCode: data.pairingCode ?? null };
}

export async function connectionState(): Promise<ConnectionState> {
  const data = await evo<{ instance?: { state?: string }; state?: string }>(
    `/instance/connectionState/${instanceName()}`,
  );
  const state = data.instance?.state ?? data.state;
  return state === 'open' || state === 'close' || state === 'connecting' ? state : 'unknown';
}

export async function logout(): Promise<void> {
  await evo(`/instance/logout/${instanceName()}`, { method: 'DELETE' });
}

/** Confere se o número tem WhatsApp e devolve o JID certo (resolve o nono dígito). */
export async function checkWhatsappNumber(digits: string): Promise<{ exists: boolean; jid: string | null }> {
  const data = await evo<Array<{ exists?: boolean; jid?: string }>>(`/chat/whatsappNumbers/${instanceName()}`, {
    method: 'POST',
    body: JSON.stringify({ numbers: [digits] }),
  });
  const item = Array.isArray(data) ? data[0] : undefined;
  return { exists: Boolean(item?.exists), jid: item?.jid ?? null };
}

export async function sendText(number: string, text: string): Promise<{ id: string | null }> {
  const data = await evo<{ key?: { id?: string } }>(`/message/sendText/${instanceName()}`, {
    method: 'POST',
    body: JSON.stringify({ number, text, delay: 1200, linkPreview: true }),
  });
  return { id: data.key?.id ?? null };
}
