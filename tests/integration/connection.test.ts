import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getAppState, updateAppState } from '@/lib/db/settings';
import { disconnectWhatsapp, refreshConnection, startConnection, syncConnectionState } from '@/lib/whatsapp/connection';

let calls: Array<{ method: string; url: string; body: Record<string, unknown> | null }>;
let state: string;
let qrCounter: number;
let missing: boolean;
let down: boolean;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  await createTestDb();
  calls = [];
  state = 'close';
  qrCounter = 0;
  missing = false;
  down = false;
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example');
  vi.stubEnv('EVOLUTION_API_KEY', 'evo-key');
  vi.stubEnv('EVOLUTION_INSTANCE', '');
  vi.stubEnv('WHATSAPP_WEBHOOK_SECRET', 'wh-secret');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith('/instance/create')) return json({ response: { message: ['already in use'] } }, 403);
      if (url.includes('/webhook/set/')) return json({ ok: true });
      if (url.includes('/instance/connectionState/')) {
        if (down) throw new TypeError('fetch failed');
        if (missing) return json({ status: 404, error: 'Not Found' }, 404);
        return json({ instance: { instanceName: 'zapflow', state } });
      }
      if (url.includes('/instance/connect/')) return json({ base64: `data:image/png;base64,QR${++qrCounter}`, code: 'x' });
      if (url.includes('/instance/logout/')) return json({ status: 'SUCCESS' });
      return json({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('startConnection', () => {
  it('creates the instance, sets the webhook and stores the QR code', async () => {
    const result = await startConnection(new Date('2026-11-09T13:00:00Z'));
    expect(result.ok).toBe(true);

    const webhook = calls.find((c) => c.url.includes('/webhook/set/zapflow'));
    const config = webhook?.body?.webhook as Record<string, unknown>;
    expect(config.url).toBe('https://zap.vercel.app/api/webhooks/whatsapp');
    expect(config.headers).toEqual({ 'x-webhook-secret': 'wh-secret' });
    expect(config.events).toEqual(['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']);

    const app = await getAppState();
    expect(app.waLastQr).toBe('data:image/png;base64,QR1');
    expect(app.waConnectionState).toBe('close');
  });

  it('reports an already connected number', async () => {
    state = 'open';
    const result = await startConnection(new Date());
    expect(result.message).toMatch(/conectado/);
    expect(calls.some((c) => c.url.includes('/instance/connect/'))).toBe(false);
  });
});

describe('refreshConnection', () => {
  it('clears the QR once the phone is connected', async () => {
    await updateAppState({ waLastQr: 'data:old', waLastQrAt: new Date() });
    state = 'open';
    expect(await refreshConnection(new Date())).toEqual({ state: 'open', qr: null });
    const app = await getAppState();
    expect(app.waConnectionState).toBe('open');
    expect(app.waLastQr).toBeNull();
  });

  it('keeps a fresh QR and renews a stale one', async () => {
    const now = new Date('2026-11-09T13:00:00Z');
    await updateAppState({ waLastQr: 'data:fresh', waLastQrAt: new Date(now.getTime() - 10_000) });
    expect((await refreshConnection(now)).qr).toBe('data:fresh');

    await updateAppState({ waLastQrAt: new Date(now.getTime() - 60_000) });
    expect((await refreshConnection(now)).qr).toBe('data:image/png;base64,QR1');
  });
});

describe('disconnectWhatsapp', () => {
  it('logs out and marks the state as closed', async () => {
    await updateAppState({ waConnectionState: 'open' });
    await disconnectWhatsapp();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/instance/logout/zapflow'))).toBe(true);
    expect((await getAppState()).waConnectionState).toBe('close');
  });
});

describe('syncConnectionState', () => {
  it('asks the WhatsApp server for the connection state and stores it', async () => {
    await updateAppState({ waConnectionState: 'open' });
    state = 'close';
    expect(await syncConnectionState()).toBe('close');
    expect((await getAppState()).waConnectionState).toBe('close');
    expect(calls.some((c) => c.url.includes('/instance/connectionState/'))).toBe(true);
  });

  it("marks the connection as unknown when the WhatsApp server doesn't answer, so nothing is sent until it does", async () => {
    await updateAppState({ waConnectionState: 'open' });
    down = true;
    await expect(syncConnectionState()).rejects.toThrow();
    expect((await getAppState()).waConnectionState).toBe('unknown');
  });

  it('treats a missing WhatsApp instance as disconnected', async () => {
    await updateAppState({ waConnectionState: 'open' });
    missing = true;
    expect(await syncConnectionState()).toBe('close');
    expect((await getAppState()).waConnectionState).toBe('close');
  });
});
