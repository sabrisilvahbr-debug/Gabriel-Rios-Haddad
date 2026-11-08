import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { errorMessage } from '@/lib/async';
import { blockPhone } from '@/lib/blocklist';
import { getDb } from '@/lib/db/client';
import { businesses, messages, type Business } from '@/lib/db/schema';
import { getAppState, updateAppState } from '@/lib/db/settings';
import { isConfigured } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { phoneLookupVariants, waNumber } from '@/lib/phone';
import { isOptOut, looksLikeAutoReply } from './detect';
import { sendText } from './evolution';
import { OPT_OUT_CONFIRMATION } from './templates';
import type { EvolutionEvent } from './webhook';

const AUTO_REPLY_WINDOW_MS = 20_000;
const OWN_MESSAGE_WINDOW_MS = 5 * 60_000;
const REPLIED_FROM = new Set(['previa_pronta', 'na_fila', 'contatada']);

export async function findBusinessByPhoneDigits(digits: string): Promise<Business | null> {
  const [business] = await getDb()
    .select()
    .from(businesses)
    .where(inArray(businesses.phoneE164, phoneLookupVariants(digits)))
    .orderBy(sql`${businesses.lastOutboundAt} desc nulls last`, desc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

/** Mensagem enviada pelo próprio sistema (pelo id ou pelo mesmo texto enviado há pouco ou sendo enviado). */
async function isOurMessage(businessId: string, id: string, text: string, now: Date): Promise<boolean> {
  const recent = new Date(now.getTime() - OWN_MESSAGE_WINDOW_MS);
  const [match] = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(
      or(
        eq(messages.waMessageId, id),
        and(
          eq(messages.businessId, businessId),
          eq(messages.direction, 'out'),
          eq(messages.body, text),
          or(eq(messages.status, 'agendada'), gte(messages.sentAt, recent)),
        ),
      ),
    )
    .limit(1);
  return Boolean(match);
}

async function sendSystemMessage(business: Business, body: string): Promise<void> {
  if (!isConfigured('whatsapp') || (await getAppState()).waConnectionState !== 'open') return;
  const [row] = await getDb()
    .insert(messages)
    .values({ businessId: business.id, direction: 'out', kind: 'sistema', body, status: 'agendada' })
    .returning({ id: messages.id });
  try {
    const sent = await sendText(business.waJid?.split('@')[0] ?? waNumber(business.phoneE164), body);
    await getDb()
      .update(messages)
      .set({ status: 'enviada', waMessageId: sent.id, sentAt: new Date() })
      .where(eq(messages.id, row.id));
  } catch (error) {
    await getDb().update(messages).set({ status: 'erro', error: errorMessage(error) }).where(eq(messages.id, row.id));
  }
}

/** A empresa pediu para sair: bloqueia o telefone, cancela a fila e confirma uma única vez. */
export async function optOutBusiness(businessId: string, now: Date = new Date()): Promise<void> {
  const [business] = await getDb().select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) return;
  const alreadyOut = business.status === 'nao_contatar' && business.optedOutAt !== null;

  await getDb()
    .update(businesses)
    .set({ status: 'nao_contatar', optedOutAt: business.optedOutAt ?? now, aiPaused: true, updatedAt: now })
    .where(eq(businesses.id, businessId));
  await blockPhone(business.phoneE164);
  await getDb()
    .update(messages)
    .set({ status: 'cancelada' })
    .where(and(eq(messages.businessId, businessId), eq(messages.status, 'agendada')));

  if (alreadyOut) return;
  await sendSystemMessage(business, OPT_OUT_CONFIRMATION);
  await logEvent('saida', `${business.name} pediu para não receber mais mensagens.`, businessId);
}

export async function handleEvolutionEvent(event: EvolutionEvent, now: Date = new Date()): Promise<void> {
  if (event.type === 'connection') {
    const state = ['open', 'close', 'connecting'].includes(event.state) ? event.state : 'unknown';
    await updateAppState({ waConnectionState: state, ...(state === 'open' ? { waLastQr: null } : {}) });
    return;
  }
  if (event.type === 'qrcode') {
    if (event.base64) await updateAppState({ waLastQr: event.base64, waLastQrAt: now });
    return;
  }
  if (event.type !== 'message' || event.isGroup || !event.phoneDigits) return;

  const business = await findBusinessByPhoneDigits(event.phoneDigits);
  if (!business) return;
  const db = getDb();

  if (event.fromMe) {
    if (await isOurMessage(business.id, event.id, event.text, now)) return;
    const [inserted] = await db
      .insert(messages)
      .values({
        businessId: business.id,
        direction: 'out',
        kind: 'manual',
        body: event.text,
        waMessageId: event.id,
        status: 'enviada',
        sentAt: event.timestamp,
      })
      .onConflictDoNothing()
      .returning({ id: messages.id });
    if (inserted) {
      await db
        .update(businesses)
        .set({ aiPaused: true, lastOutboundAt: now, updatedAt: now })
        .where(eq(businesses.id, business.id));
    }
    return;
  }

  const sinceOurMessage = business.lastOutboundAt ? event.timestamp.getTime() - business.lastOutboundAt.getTime() : Infinity;
  const isAutoReply = sinceOurMessage >= 0 && sinceOurMessage <= AUTO_REPLY_WINDOW_MS && looksLikeAutoReply(event.text);

  const [inserted] = await db
    .insert(messages)
    .values({
      businessId: business.id,
      direction: 'in',
      kind: isAutoReply ? 'auto_resposta' : 'recebida',
      body: event.text,
      waMessageId: event.id,
      status: 'recebida',
      sentAt: event.timestamp,
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });
  if (!inserted || isAutoReply) return;

  if (isOptOut(event.text)) {
    await optOutBusiness(business.id, now);
    return;
  }

  await db
    .update(businesses)
    .set({
      lastInboundAt: now,
      updatedAt: now,
      ...(REPLIED_FROM.has(business.status) ? { status: 'respondeu' as const } : {}),
    })
    .where(eq(businesses.id, business.id));
  await logEvent('resposta', `${business.name} respondeu: "${event.text.slice(0, 80)}"`, business.id);
}
