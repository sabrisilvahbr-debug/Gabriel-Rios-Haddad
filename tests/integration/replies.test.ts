import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { seedBusiness } from '../helpers/seed';
import type { DB } from '@/lib/db/client';
import { blockedPhones, businesses, messages, type Business } from '@/lib/db/schema';
import { updateAppState, updateSettings } from '@/lib/db/settings';
import { maxDuration } from '@/app/api/cron/tick/route';
import { runTick } from '@/lib/cron/tick';
import { runRepliesStep } from '@/lib/whatsapp/replies';

let db: DB;
let business: Business;
let sends: Array<{ number: string; text: string }>;
let geminiCalls: number;
let holdFirstGemini: Promise<void> | null;
let decision: { reply: string; intent: string; handoff: boolean } | 'erro';

const LAST_IN = new Date('2026-11-09T13:01:00Z');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  db = await createTestDb();
  sends = [];
  geminiCalls = 0;
  holdFirstGemini = null;
  decision = { reply: 'Fica R$ 497 à vista. Posso colocar no ar?', intent: 'duvida', handoff: false };
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  vi.stubEnv('GEMINI_API_KEY', 'chave');
  vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example');
  vi.stubEnv('EVOLUTION_API_KEY', 'evo-key');
  vi.stubEnv('WHATSAPP_WEBHOOK_SECRET', 'wh');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        geminiCalls++;
        if (holdFirstGemini && geminiCalls === 1) await holdFirstGemini;
        if (decision === 'erro') return json({ error: 'quota' }, 429);
        return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }] });
      }
      if (url.includes('/instance/connectionState/')) return json({ instance: { state: 'open' } });
      if (url.includes('/message/sendText/')) {
        const body = JSON.parse(String(init.body));
        sends.push({ number: body.number, text: body.text });
        return json({ key: { id: `AI${sends.length}` } });
      }
      return json({}, 404);
    }),
  );
  await updateSettings({
    agencyName: 'Agência Sol',
    agencyWhatsapp: '+5519900001111',
    aiRepliesEnabled: true,
    aiMaxReplies: 8,
    offerText: 'Site por R$ 497 à vista.',
  });
  await updateAppState({ waConnectionState: 'open' });
  ({ business } = await seedBusiness(db, {
    status: 'respondeu',
    lastOutboundAt: new Date(LAST_IN.getTime() - 60_000),
    lastInboundAt: LAST_IN,
  }));
  await db.insert(messages).values([
    { businessId: business.id, direction: 'out', kind: 'primeiro_contato', body: 'Oi! Prévia: https://x', status: 'enviada', sentAt: new Date(LAST_IN.getTime() - 60_000), waMessageId: 'OUT1' },
    { businessId: business.id, direction: 'in', kind: 'recebida', body: 'Quanto custa?', status: 'recebida', sentAt: LAST_IN, waMessageId: 'IN1' },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reload = async () => (await db.select().from(businesses).where(eq(businesses.id, business.id)))[0];
const after = (seconds: number) => new Date(LAST_IN.getTime() + seconds * 1000);

describe('runRepliesStep', () => {
  it('waits 45 seconds to collect messages in a row', async () => {
    expect(await runRepliesStep(after(30))).toBe(0);
    expect(geminiCalls).toBe(0);
  });

  it('answers with the AI and records the reply', async () => {
    expect(await runRepliesStep(after(60))).toBe(1);
    expect(sends).toEqual([{ number: '5519987654321', text: 'Fica R$ 497 à vista. Posso colocar no ar?' }]);
    const saved = await reload();
    expect(saved.aiReplyCount).toBe(1);
    expect(saved.lastOutboundAt?.getTime()).toBe(after(60).getTime());
    const ai = (await db.select().from(messages).where(eq(messages.kind, 'ia')))[0];
    expect(ai).toMatchObject({ status: 'enviada', waMessageId: 'AI1' });

    expect(await runRepliesStep(after(120))).toBe(0);
  });

  it('hands interested businesses over to the owner', async () => {
    decision = { reply: 'Ótimo! A Agência Sol vai falar com você em seguida.', intent: 'interessado', handoff: true };
    await runRepliesStep(after(60));
    const saved = await reload();
    expect(saved.aiPaused).toBe(true);
    expect(saved.status).toBe('interessada');
    expect(sends).toHaveLength(2);
    expect(sends[1].number).toBe('5519900001111');
    expect(sends[1].text).toContain(business.name);
    expect(sends[1].text).toContain(`https://zap.vercel.app/painel/empresas/${business.id}`);
  });

  it('stops contacting businesses with no interest', async () => {
    decision = { reply: 'Sem problemas, obrigado pela atenção!', intent: 'sem_interesse', handoff: false };
    await runRepliesStep(after(60));
    const saved = await reload();
    expect(saved.status).toBe('nao_contatar');
    expect(await db.select().from(blockedPhones)).toHaveLength(1);
    expect(sends).toHaveLength(1);
  });

  it('passes the conversation to the owner at the reply limit', async () => {
    await db.update(businesses).set({ aiReplyCount: 8 }).where(eq(businesses.id, business.id));
    expect(await runRepliesStep(after(60))).toBe(0);
    expect(geminiCalls).toBe(0);
    expect((await reload()).aiPaused).toBe(true);
    expect(sends.map((s) => s.number)).toEqual(['5519900001111']);
  });

  it('passes the conversation to the owner when the AI fails', async () => {
    decision = 'erro';
    expect(await runRepliesStep(after(60))).toBe(0);
    expect((await reload()).aiPaused).toBe(true);
    expect(sends.map((s) => s.number)).toEqual(['5519900001111']);
  });

  it('does nothing when disabled, paused or disconnected', async () => {
    await updateSettings({ aiRepliesEnabled: false });
    expect(await runRepliesStep(after(60))).toBe(0);
    await updateSettings({ aiRepliesEnabled: true });

    await updateAppState({ waConnectionState: 'close' });
    expect(await runRepliesStep(after(60))).toBe(0);
    await updateAppState({ waConnectionState: 'open' });

    await db.update(businesses).set({ aiPaused: true }).where(eq(businesses.id, business.id));
    expect(await runRepliesStep(after(60))).toBe(0);
    expect(geminiCalls).toBe(0);
  });
});

describe('runTick with a slow AI', () => {
  it('keeps the next tick out while a slow one can still be running, so nobody gets the same reply twice', async () => {
    let release!: () => void;
    holdFirstGemini = new Promise<void>((resolve) => (release = resolve));
    const start = new Date(LAST_IN.getTime() + 60_000);

    const slow = runTick(start);
    await vi.waitFor(() => expect(geminiCalls).toBe(1));
    const next = await runTick(new Date(start.getTime() + (maxDuration - 1) * 1000));
    release();
    await slow;

    expect(next.locked).toBe(true);
    expect(sends).toHaveLength(1);
  });
});
