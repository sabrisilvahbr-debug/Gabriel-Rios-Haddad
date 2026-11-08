import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { seedBusiness } from '../helpers/seed';
import type { DB } from '@/lib/db/client';
import { blockedPhones, businesses, messages } from '@/lib/db/schema';
import { getAppState, updateAppState, updateSettings } from '@/lib/db/settings';
import {
  listSendQueue,
  markQueuedMessageSent,
  recordManualSend,
  registerInboundMessage,
  suggestReply,
} from '@/lib/whatsapp/manual';
import { enqueueFirstContact } from '@/lib/whatsapp/outreach';

let db: DB;
const NOW = new Date('2026-11-09T13:00:00Z'); // segunda, 10h em Brasília

beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  vi.stubEnv('GEMINI_API_KEY', '');
  await updateSettings({ agencyName: 'Agência Sol', dailyLimit: 2 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const messagesOf = (id: string) => db.select().from(messages).where(eq(messages.businessId, id));
const businessById = async (id: string) => (await db.select().from(businesses).where(eq(businesses.id, id)))[0];

describe('listSendQueue', () => {
  it('lists what is left of the daily limit, oldest first, with a WhatsApp link ready', async () => {
    const first = await seedBusiness(db, { phoneE164: '+5519911110001' });
    const second = await seedBusiness(db, { phoneE164: '+5519911110002' });
    await enqueueFirstContact(first.business.id);
    await enqueueFirstContact(second.business.id);
    await updateAppState({ sentDay: '2026-11-09', sentCount: 1 });

    const queue = await listSendQueue(NOW);
    expect(queue).toMatchObject({ sentToday: 1, dailyLimit: 2, remaining: 1, waiting: 2 });
    expect(queue.items).toHaveLength(1);
    const [item] = queue.items;
    const [queued] = await messagesOf(first.business.id);
    expect(item.messageId).toBe(queued.id);
    expect(item.businessId).toBe(first.business.id);
    expect(item.body).toContain(`https://zap.vercel.app/s/${first.site.slug}`);
    expect(item.link).toBe(`https://wa.me/5519911110001?text=${encodeURIComponent(item.body)}`);
  });

  it('starts a new count on a new day in Brasília', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    await updateAppState({ sentDay: '2026-11-08', sentCount: 2 });
    const queue = await listSendQueue(NOW);
    expect(queue.sentToday).toBe(0);
    expect(queue.items).toHaveLength(1);
  });

  it('leaves out businesses that can no longer be contacted', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    await db.update(businesses).set({ status: 'nao_contatar' }).where(eq(businesses.id, business.id));
    expect((await listSendQueue(NOW)).items).toHaveLength(0);
  });
});

describe('markQueuedMessageSent', () => {
  it('marks the message as sent, the business as contacted and counts it for today', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    const [queued] = await messagesOf(business.id);

    expect((await markQueuedMessageSent(queued.id, NOW)).ok).toBe(true);
    const [message] = await messagesOf(business.id);
    expect(message.status).toBe('enviada');
    expect(message.sentAt).toEqual(NOW);
    const updated = await businessById(business.id);
    expect(updated.status).toBe('contatada');
    expect(updated.lastOutboundAt).toEqual(NOW);
    expect(await getAppState()).toMatchObject({ sentDay: '2026-11-09', sentCount: 1 });
  });

  it('counts a double tap only once', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    const [queued] = await messagesOf(business.id);
    await markQueuedMessageSent(queued.id, NOW);
    expect((await markQueuedMessageSent(queued.id, NOW)).ok).toBe(false);
    expect((await getAppState()).sentCount).toBe(1);
  });
});

describe('registerInboundMessage', () => {
  it('saves the pasted reply and moves the business to Respondeu', async () => {
    const { business } = await seedBusiness(db, { status: 'contatada' });
    expect(await registerInboundMessage(business.id, '  Quanto custa?  ', NOW)).toMatchObject({ ok: true, optOut: false });
    const [message] = await messagesOf(business.id);
    expect(message).toMatchObject({ direction: 'in', kind: 'recebida', body: 'Quanto custa?' });
    const updated = await businessById(business.id);
    expect(updated.status).toBe('respondeu');
    expect(updated.lastInboundAt).toEqual(NOW);
  });

  it('blocks the number when the business asks to stop', async () => {
    const { business } = await seedBusiness(db, { status: 'contatada' });
    expect((await registerInboundMessage(business.id, 'SAIR', NOW)).optOut).toBe(true);
    expect((await businessById(business.id)).status).toBe('nao_contatar');
    expect(await db.select().from(blockedPhones)).toHaveLength(1);
  });

  it('refuses an empty reply', async () => {
    const { business } = await seedBusiness(db);
    expect((await registerInboundMessage(business.id, '   ', NOW)).ok).toBe(false);
    expect(await messagesOf(business.id)).toHaveLength(0);
  });
});

describe('recordManualSend', () => {
  it('records replies sent from the phone; AI suggestions count toward the AI limit', async () => {
    const { business } = await seedBusiness(db, { status: 'respondeu' });
    await recordManualSend(business.id, 'Fica R$ 497.', 'ia', NOW);
    await recordManualSend(business.id, 'Qualquer dúvida, me chame.', 'manual', NOW);
    const sent = await messagesOf(business.id);
    expect(sent.map((m) => `${m.kind}:${m.status}`).sort()).toEqual(['ia:enviada', 'manual:enviada']);
    const updated = await businessById(business.id);
    expect(updated.aiReplyCount).toBe(1);
    expect(updated.lastOutboundAt).toEqual(NOW);
  });
});

describe('suggestReply', () => {
  it('asks the AI for a reply based on the conversation and flags interested businesses', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'chave');
    let prompt = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        prompt = String(init.body);
        const decision = { reply: 'Fica R$ 497 à vista. Posso colocar no ar?', intent: 'interessado', handoff: true };
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }] }), {
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const { business } = await seedBusiness(db, { status: 'respondeu' });
    await registerInboundMessage(business.id, 'Quero fechar, quanto fica?', NOW);

    expect(await suggestReply(business.id)).toMatchObject({
      ok: true,
      reply: 'Fica R$ 497 à vista. Posso colocar no ar?',
      intent: 'interessado',
    });
    expect(prompt).toContain('Quero fechar, quanto fica?');
    expect((await businessById(business.id)).status).toBe('interessada');
  });

  it('explains when the AI key is missing', async () => {
    const { business } = await seedBusiness(db);
    const result = await suggestReply(business.id);
    expect(result.ok).toBe(false);
  });
});
