import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { seedBusiness } from '../helpers/seed';
import { POST as registrar } from '@/app/api/whatsapp/registrar/route';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import type { DB } from '@/lib/db/client';
import { messages } from '@/lib/db/schema';
import { updateSettings } from '@/lib/db/settings';
import { enqueueFirstContact } from '@/lib/whatsapp/outreach';

let db: DB;

beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv('SESSION_SECRET', 'segredo-de-teste-com-mais-de-32-caracteres');
  vi.stubEnv('APP_URL', 'https://zap.vercel.app');
  await updateSettings({ agencyName: 'Agência Sol' });
});

afterEach(() => vi.unstubAllEnvs());

function post(body: unknown, cookie?: string) {
  return registrar(
    new Request('https://zap.vercel.app/api/whatsapp/registrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/whatsapp/registrar', () => {
  it('refuses requests without the panel session', async () => {
    expect((await post({ messageId: 'x' })).status).toBe(401);
    expect((await post({ messageId: 'x' }, `${SESSION_COOKIE}=token-falso`)).status).toBe(401);
  });

  it('marks a queued message as sent when the panel taps "Enviar no WhatsApp"', async () => {
    const { business } = await seedBusiness(db);
    await enqueueFirstContact(business.id);
    const [queued] = await db.select().from(messages).where(eq(messages.businessId, business.id));
    const cookie = `outro=1; ${SESSION_COOKIE}=${await createSessionToken()}`;

    expect((await post({ messageId: queued.id }, cookie)).status).toBe(200);
    const [message] = await db.select().from(messages).where(eq(messages.id, queued.id));
    expect(message.status).toBe('enviada');
  });

  it('records a reply typed or suggested in the panel', async () => {
    const { business } = await seedBusiness(db, { status: 'respondeu' });
    const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
    const response = await post({ businessId: business.id, text: 'Fica R$ 497.', kind: 'ia' }, cookie);
    expect(response.status).toBe(200);
    const [message] = await db.select().from(messages).where(eq(messages.businessId, business.id));
    expect(message).toMatchObject({ direction: 'out', kind: 'ia', status: 'enviada', body: 'Fica R$ 497.' });
  });

  it('rejects malformed bodies', async () => {
    const cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
    expect((await post({ businessId: 'x', text: 'oi', kind: 'sistema' }, cookie)).status).toBe(400);
    expect((await post({}, cookie)).status).toBe(400);
  });
});
