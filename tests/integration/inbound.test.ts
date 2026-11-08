import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { seedBusiness } from '../helpers/seed';
import { POST as whatsappWebhook } from '@/app/api/webhooks/whatsapp/route';
import type { DB } from '@/lib/db/client';
import { blockedPhones, businesses, messages, type Business } from '@/lib/db/schema';
import { getAppState, updateAppState, updateSettings } from '@/lib/db/settings';
import { handleEvolutionEvent } from '@/lib/whatsapp/inbound';
import { OPT_OUT_CONFIRMATION } from '@/lib/whatsapp/templates';

let db: DB;
let sends: Array<{ number: string; text: string }>;
let business: Business;

const SENT_AT = new Date('2026-11-09T13:00:00Z');
const OUT_BODY = 'Oi! Montei uma prévia: https://zap.vercel.app/s/x. Responda SAIR para não receber.';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const message = (overrides: Partial<{ id: string; fromMe: boolean; digits: string; text: string; at: Date }> = {}) => ({
  type: 'message' as const,
  id: overrides.id ?? `IN-${Math.random()}`,
  fromMe: overrides.fromMe ?? false,
  phoneDigits: overrides.digits ?? '5519987654321',
  text: overrides.text ?? 'Quanto custa?',
  isGroup: false,
  timestamp: overrides.at ?? new Date(SENT_AT.getTime() + 5 * 60_000),
});

beforeEach(async () => {
  db = await createTestDb();
  sends = [];
  vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example');
  vi.stubEnv('EVOLUTION_API_KEY', 'evo-key');
  vi.stubEnv('WHATSAPP_WEBHOOK_SECRET', 'wh-secret');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes('/message/sendText/')) {
        const body = JSON.parse(String(init.body));
        sends.push({ number: body.number, text: body.text });
        return json({ key: { id: `SYS${sends.length}` } });
      }
      return json({}, 404);
    }),
  );
  await updateSettings({ agencyName: 'Agência Sol' });
  await updateAppState({ waConnectionState: 'open' });
  ({ business } = await seedBusiness(db, { status: 'contatada', lastOutboundAt: SENT_AT }));
  await db.insert(messages).values({
    businessId: business.id,
    direction: 'out',
    kind: 'primeiro_contato',
    body: OUT_BODY,
    waMessageId: 'OUT1',
    status: 'enviada',
    sentAt: SENT_AT,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reload = async () => (await db.select().from(businesses).where(eq(businesses.id, business.id)))[0];
const all = () => db.select().from(messages).where(eq(messages.businessId, business.id));

describe('replies from the business', () => {
  it('stores a normal reply and marks the business as "respondeu"', async () => {
    const now = new Date(SENT_AT.getTime() + 5 * 60_000);
    await handleEvolutionEvent(message({ id: 'R1' }), now);
    const saved = await reload();
    expect(saved.status).toBe('respondeu');
    expect(saved.lastInboundAt?.getTime()).toBe(now.getTime());
    const [reply] = (await all()).filter((m) => m.direction === 'in');
    expect(reply).toMatchObject({ kind: 'recebida', status: 'recebida', waMessageId: 'R1', body: 'Quanto custa?' });
  });

  it('stores a repeated webhook only once', async () => {
    await handleEvolutionEvent(message({ id: 'R1' }));
    await handleEvolutionEvent(message({ id: 'R1' }));
    expect((await all()).filter((m) => m.direction === 'in')).toHaveLength(1);
  });

  it('matches a JID without the ninth digit', async () => {
    await handleEvolutionEvent(message({ id: 'R2', digits: '551987654321' }));
    expect((await reload()).status).toBe('respondeu');
  });

  it('ignores numbers that are not leads', async () => {
    await handleEvolutionEvent(message({ id: 'R3', digits: '5511999998888' }));
    expect((await db.select().from(messages)).filter((m) => m.direction === 'in')).toHaveLength(0);
  });

  it('treats a fast automatic greeting as an auto-reply', async () => {
    await handleEvolutionEvent(
      message({ id: 'A1', text: 'Olá! Obrigado pelo contato, em breve retornaremos.', at: new Date(SENT_AT.getTime() + 10_000) }),
      new Date(SENT_AT.getTime() + 10_000),
    );
    const saved = await reload();
    expect(saved.status).toBe('contatada');
    expect(saved.lastInboundAt).toBeNull();
    const [auto] = (await all()).filter((m) => m.direction === 'in');
    expect(auto.kind).toBe('auto_resposta');
  });
});

describe('opt-out', () => {
  it('blocks the phone, cancels queued messages and confirms once', async () => {
    await db.insert(messages).values({ businessId: business.id, direction: 'out', kind: 'follow_up', body: 'Lembrete', status: 'agendada' });

    await handleEvolutionEvent(message({ id: 'S1', text: 'SAIR' }));
    await handleEvolutionEvent(message({ id: 'S2', text: 'sair' }));

    const saved = await reload();
    expect(saved.status).toBe('nao_contatar');
    expect(saved.optedOutAt).not.toBeNull();
    expect(await db.select().from(blockedPhones)).toHaveLength(1);
    const [followUp] = await db.select().from(messages).where(and(eq(messages.businessId, business.id), eq(messages.kind, 'follow_up')));
    expect(followUp.status).toBe('cancelada');
    expect(sends).toEqual([{ number: '5519987654321', text: OPT_OUT_CONFIRMATION }]);
  });
});

describe('messages sent from the phone', () => {
  it('pauses the AI when the owner answers by hand', async () => {
    await handleEvolutionEvent(message({ id: 'M1', fromMe: true, text: 'Oi! Aqui é a Sabrina, posso te ligar?' }));
    const saved = await reload();
    expect(saved.aiPaused).toBe(true);
    const manual = (await all()).find((m) => m.waMessageId === 'M1');
    expect(manual?.kind).toBe('manual');
  });

  it('recognizes our own outgoing messages by id or by text', async () => {
    await handleEvolutionEvent(message({ id: 'OUT1', fromMe: true, text: OUT_BODY }));
    await handleEvolutionEvent(message({ id: 'OTHER', fromMe: true, text: OUT_BODY, at: new Date(SENT_AT.getTime() + 30_000) }), new Date(SENT_AT.getTime() + 30_000));
    expect(await all()).toHaveLength(1);
    expect((await reload()).aiPaused).toBe(false);
  });
});

describe('manual messages from the panel', () => {
  it('survives the webhook echo arriving before the send returns', async () => {
    const text = 'Oi! Posso te ligar amanhã?';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/message/sendText/')) {
          await handleEvolutionEvent(message({ id: 'MAN1', fromMe: true, text }));
          return json({ key: { id: 'MAN1' } });
        }
        return json({}, 404);
      }),
    );
    const { sendManualMessage } = await import('@/lib/whatsapp/outreach');
    const result = await sendManualMessage(business.id, text);
    expect(result.ok).toBe(true);
    const manual = (await all()).filter((m) => m.kind === 'manual');
    expect(manual).toHaveLength(1);
    expect(manual[0]).toMatchObject({ waMessageId: 'MAN1', status: 'enviada' });
    expect((await reload()).aiPaused).toBe(true);
  });
});

describe('connection events and the route', () => {
  it('updates the connection state and the QR code', async () => {
    await handleEvolutionEvent({ type: 'qrcode', base64: 'data:image/png;base64,QQ' });
    expect((await getAppState()).waLastQr).toBe('data:image/png;base64,QQ');
    await handleEvolutionEvent({ type: 'connection', state: 'close' });
    expect((await getAppState()).waConnectionState).toBe('close');
  });

  it('requires the webhook secret', async () => {
    const payload = { event: 'connection.update', data: { state: 'open' } };
    const denied = await whatsappWebhook(new Request('https://zap.vercel.app/api/webhooks/whatsapp', { method: 'POST', body: JSON.stringify(payload) }));
    expect(denied.status).toBe(401);
    const accepted = await whatsappWebhook(
      new Request('https://zap.vercel.app/api/webhooks/whatsapp', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'x-webhook-secret': 'wh-secret' },
      }),
    );
    expect(accepted.status).toBe(200);
    expect((await getAppState()).waConnectionState).toBe('open');
  });
});
