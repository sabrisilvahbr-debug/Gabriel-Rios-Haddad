import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { seedBusiness } from '../helpers/seed';
import { GET as cronTick } from '@/app/api/cron/tick/route';
import { runTick } from '@/lib/cron/tick';
import type { DB } from '@/lib/db/client';
import { businesses, messages } from '@/lib/db/schema';
import { getAppState, updateAppState, updateSettings } from '@/lib/db/settings';
import { enqueueAllReady, enqueueFirstContact, runOutreachStep, scheduleFollowUps } from '@/lib/whatsapp/outreach';

let db: DB;
let sends: Array<{ number: string; text: string }>;
let exists: boolean;
let sendFails: boolean;
let connState: string;
let stateChecks: number;

const MONDAY_10H = new Date('2026-11-09T13:00:00Z'); // segunda, 10:00 em Brasília
const SUNDAY_10H = new Date('2026-11-08T13:00:00Z');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(async () => {
  db = await createTestDb();
  sends = [];
  exists = true;
  sendFails = false;
  connState = 'open';
  stateChecks = 0;
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example/');
  vi.stubEnv('EVOLUTION_API_KEY', 'evo-key');
  vi.stubEnv('EVOLUTION_INSTANCE', 'zapflow');
  vi.stubEnv('WHATSAPP_WEBHOOK_SECRET', 'wh-secret');
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.stubEnv('VERCEL_API_TOKEN', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      expect((init.headers as Record<string, string>).apikey).toBe('evo-key');
      const body = init.body ? JSON.parse(String(init.body)) : {};
      if (url === 'https://evo.example/instance/connectionState/zapflow') {
        stateChecks++;
        return json({ instance: { instanceName: 'zapflow', state: connState } });
      }
      if (url === 'https://evo.example/chat/whatsappNumbers/zapflow') {
        return json([{ exists, jid: `${body.numbers[0]}@s.whatsapp.net`, number: body.numbers[0] }]);
      }
      if (url === 'https://evo.example/message/sendText/zapflow') {
        if (sendFails) return json({ error: 'Connection Closed' }, 500);
        sends.push({ number: body.number, text: body.text });
        return json({ key: { remoteJid: `${body.number}@s.whatsapp.net`, fromMe: true, id: `WAID${sends.length}` } });
      }
      return json({}, 404);
    }),
  );
  await updateSettings({ agencyName: 'Agência Sol', outreachEnabled: true, dailyLimit: 20 });
  await updateAppState({ waConnectionState: 'open' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const messagesOf = (businessId: string) => db.select().from(messages).where(eq(messages.businessId, businessId));
const businessById = async (id: string) => (await db.select().from(businesses).where(eq(businesses.id, id)))[0];

describe('enqueue', () => {
  it('queues the first message with the preview link', async () => {
    const { business, site } = await seedBusiness(db);
    expect((await enqueueFirstContact(business.id)).ok).toBe(true);
    const [message] = await messagesOf(business.id);
    expect(message.status).toBe('agendada');
    expect(message.kind).toBe('primeiro_contato');
    expect(message.body).toContain(`https://zap.vercel.app/s/${site.slug}`);
    expect(message.body).toContain('Agência Sol');
    expect((await businessById(business.id)).status).toBe('na_fila');

    const again = await enqueueFirstContact(business.id);
    expect(again.ok).toBe(false);
    expect(await messagesOf(business.id)).toHaveLength(1);
  });

  it('refuses landlines and blocked statuses', async () => {
    const { business: landline } = await seedBusiness(db, { phoneIsMobile: false, phoneE164: '+551932324545' });
    expect((await enqueueFirstContact(landline.id)).message).toMatch(/fixo/);
    const { business: optedOut } = await seedBusiness(db, { status: 'nao_contatar' });
    expect((await enqueueFirstContact(optedOut.id)).ok).toBe(false);
  });

  it('never queues a first message to a phone another business already uses', async () => {
    const { business } = await seedBusiness(db);
    const { business: twin } = await seedBusiness(db, { phoneE164: business.phoneE164 });
    expect((await enqueueFirstContact(business.id)).ok).toBe(true);
    const refused = await enqueueFirstContact(twin.id);
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain(business.name);
    expect(await messagesOf(twin.id)).toHaveLength(0);
  });

  it('enqueueAllReady queues every ready preview', async () => {
    await seedBusiness(db);
    await seedBusiness(db, { phoneE164: '+5519911112222' });
    await seedBusiness(db, { status: 'contatada', phoneE164: '+5519933334444' });
    expect(await enqueueAllReady()).toBe(2);
  });
});

describe('runOutreachStep', () => {
  it('sends one queued message and schedules the next interval', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);

    const result = await runOutreachStep(MONDAY_10H);
    expect(result.result).toBe('sent');
    expect(sends).toEqual([{ number: '5519987654321', text: expect.stringContaining('/s/') }]);

    const [message] = await messagesOf(business.id);
    expect(message.status).toBe('enviada');
    expect(message.waMessageId).toBe('WAID1');
    const saved = await businessById(business.id);
    expect(saved.status).toBe('contatada');
    expect(saved.whatsappStatus).toBe('yes');
    expect(saved.waJid).toBe('5519987654321@s.whatsapp.net');

    const state = await getAppState();
    expect(state.sentCount).toBe(1);
    expect(state.sentDay).toBe('2026-11-09');
    expect(state.nextSendAfter!.getTime()).toBeGreaterThanOrEqual(MONDAY_10H.getTime() + 4 * 60_000);

    expect((await runOutreachStep(MONDAY_10H)).result).toBe('skipped');
  });

  it('does nothing outside the window, when disabled, disconnected or over the daily limit', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);

    expect((await runOutreachStep(SUNDAY_10H)).reason).toMatch(/horário/);

    await updateSettings({ outreachEnabled: false });
    expect((await runOutreachStep(MONDAY_10H)).reason).toMatch(/desligado/);
    await updateSettings({ outreachEnabled: true });

    await updateAppState({ waConnectionState: 'close' });
    expect((await runOutreachStep(MONDAY_10H)).reason).toMatch(/desconectado/);
    await updateAppState({ waConnectionState: 'open' });

    await updateSettings({ dailyLimit: 1 });
    await updateAppState({ sentDay: '2026-11-09', sentCount: 1 });
    expect((await runOutreachStep(MONDAY_10H)).reason).toMatch(/limite/);
    expect(sends).toHaveLength(0);
  });

  it('resets the daily counter on a new Brasília day', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    await updateAppState({ sentDay: '2026-11-08', sentCount: 20 });
    expect((await runOutreachStep(MONDAY_10H)).result).toBe('sent');
    expect((await getAppState()).sentCount).toBe(1);
  });

  it('cancels numbers without WhatsApp', async () => {
    exists = false;
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    await runOutreachStep(MONDAY_10H);
    expect(sends).toHaveLength(0);
    expect((await businessById(business.id)).status).toBe('sem_whatsapp');
    const [message] = await messagesOf(business.id);
    expect(message.status).toBe('cancelada');
  });

  it('puts the business back in Prévia pronta when the send fails, so it can be queued again', async () => {
    sendFails = true;
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    expect((await runOutreachStep(MONDAY_10H)).result).toBe('error');
    const [message] = await messagesOf(business.id);
    expect(message.status).toBe('erro');
    expect((await businessById(business.id)).status).toBe('previa_pronta');
    expect(await enqueueAllReady()).toBe(1);
  });
});

describe('runTick', () => {
  it('never sends twice when two ticks run at the same time', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    const { business: other } = await seedBusiness(db, { phoneE164: '+5519911112222' });
    await enqueueFirstContact(other.id);

    const reports = await Promise.all([runTick(MONDAY_10H), runTick(MONDAY_10H)]);
    expect(reports.filter((r) => r.locked)).toHaveLength(1);
    expect(sends).toHaveLength(1);
    expect((await getAppState()).tickLockedUntil).toBeNull();
  });

  it('checks the WhatsApp connection on every tick, which also keeps a sleeping WhatsApp server awake', async () => {
    connState = 'close';
    const report = await runTick(SUNDAY_10H);
    expect(stateChecks).toBe(1);
    expect(report.errors).toEqual([]);
    expect((await getAppState()).waConnectionState).toBe('close');
  });

  it('the cron route requires the secret', async () => {
    const unauthorized = await cronTick(new Request('https://zap.vercel.app/api/cron/tick'));
    expect(unauthorized.status).toBe(401);
    const authorized = await cronTick(
      new Request('https://zap.vercel.app/api/cron/tick', { headers: { authorization: 'Bearer cron-secret' } }),
    );
    expect(authorized.status).toBe(200);
  });
});

describe('scheduleFollowUps', () => {
  it('queues a single reminder after the configured days', async () => {
    await updateSettings({ followUpEnabled: true, followUpAfterDays: 3, followUpTemplate: 'Viu a prévia, {empresa}? {link}' });
    const fourDaysAgo = new Date(MONDAY_10H.getTime() - 4 * 86_400_000);
    const { business } = await seedBusiness(db, { status: 'contatada', lastOutboundAt: fourDaysAgo });
    const { business: recent } = await seedBusiness(db, {
      status: 'contatada',
      lastOutboundAt: new Date(MONDAY_10H.getTime() - 86_400_000),
      phoneE164: '+5519911112222',
    });

    expect(await scheduleFollowUps(MONDAY_10H)).toBe(1);
    expect(await scheduleFollowUps(MONDAY_10H)).toBe(0);
    const followUps = await db
      .select()
      .from(messages)
      .where(and(eq(messages.businessId, business.id), eq(messages.kind, 'follow_up')));
    expect(followUps).toHaveLength(1);
    expect(followUps[0].body).toContain(business.name);
    expect(await messagesOf(recent.id)).toHaveLength(0);
  });
});
