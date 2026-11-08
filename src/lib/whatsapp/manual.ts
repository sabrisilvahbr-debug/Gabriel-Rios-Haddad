import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { generateReply, type ReplyIntent } from '@/lib/ai/responder';
import { errorMessage } from '@/lib/async';
import { isBlocked } from '@/lib/blocklist';
import { getDb } from '@/lib/db/client';
import { appState, businesses, messages, type Business } from '@/lib/db/schema';
import { getAppState, getSettings, updateAppState } from '@/lib/db/settings';
import { isConfigured } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { waNumber } from '@/lib/phone';
import { saoPauloParts } from '@/lib/time';
import { isOptOut } from './detect';
import { optOutBusiness, REPLIED_FROM } from './inbound';
import { whatsappLink } from './link';
import { NOT_CONTACTABLE } from './outreach';
import { buildReplyContext } from './replies';

/*
 * Modo celular: sem servidor de WhatsApp, a dona envia pelo próprio aparelho.
 * O painel prepara cada mensagem (link wa.me com o texto), registra o que foi enviado
 * e guarda as respostas que ela cola, para a IA sugerir a próxima mensagem.
 */

type Result = { ok: boolean; message: string };

export interface SendQueueItem {
  messageId: string;
  businessId: string;
  businessName: string;
  city: string | null;
  kind: 'primeiro_contato' | 'follow_up';
  body: string;
  link: string;
}

export interface SendQueue {
  sentToday: number;
  dailyLimit: number;
  remaining: number;
  /** Mensagens na fila, inclusive as que passam do limite de hoje. */
  waiting: number;
  items: SendQueueItem[];
}

export function phoneDigitsOf(business: Pick<Business, 'waJid' | 'phoneE164'>): string {
  return business.waJid?.split('@')[0] ?? waNumber(business.phoneE164);
}

function sentTodayFrom(state: { sentDay: string | null; sentCount: number }, now: Date): number {
  return state.sentDay === saoPauloParts(now).day ? state.sentCount : 0;
}

/** Mensagens prontas para enviar hoje, das mais antigas para as mais novas, até o limite do dia. */
export async function listSendQueue(now: Date): Promise<SendQueue> {
  const [settings, state] = await Promise.all([getSettings(), getAppState()]);
  const sentToday = sentTodayFrom(state, now);
  const remaining = Math.max(settings.dailyLimit - sentToday, 0);
  const rows = await getDb()
    .select({ messageId: messages.id, kind: messages.kind, body: messages.body, business: businesses })
    .from(messages)
    .innerJoin(businesses, eq(businesses.id, messages.businessId))
    .where(
      and(
        eq(messages.direction, 'out'),
        eq(messages.status, 'agendada'),
        inArray(messages.kind, ['primeiro_contato', 'follow_up']),
        notInArray(businesses.status, [...NOT_CONTACTABLE]),
      ),
    )
    .orderBy(asc(messages.createdAt));

  const items: SendQueueItem[] = [];
  for (const row of rows) {
    if (items.length >= remaining) break;
    if (await isBlocked(row.business.phoneE164)) continue;
    items.push({
      messageId: row.messageId,
      businessId: row.business.id,
      businessName: row.business.name,
      city: row.business.city,
      kind: row.kind === 'follow_up' ? 'follow_up' : 'primeiro_contato',
      body: row.body,
      link: whatsappLink(phoneDigitsOf(row.business), row.body),
    });
  }
  return { sentToday, dailyLimit: settings.dailyLimit, remaining, waiting: rows.length, items };
}

/** A dona tocou em "Enviar no WhatsApp" numa mensagem da fila. Tocar duas vezes conta uma vez só. */
export async function markQueuedMessageSent(messageId: string, now: Date): Promise<Result> {
  const db = getDb();
  const [message] = await db
    .update(messages)
    .set({ status: 'enviada', sentAt: now, error: null })
    .where(and(eq(messages.id, messageId), eq(messages.direction, 'out'), eq(messages.status, 'agendada')))
    .returning();
  if (!message) return { ok: false, message: 'Essa mensagem já estava marcada como enviada.' };

  const [business] = await db.select().from(businesses).where(eq(businesses.id, message.businessId)).limit(1);
  const contacted = message.kind === 'primeiro_contato' && ['nova', 'previa_pronta', 'na_fila'].includes(business.status);
  await db
    .update(businesses)
    .set({ lastOutboundAt: now, updatedAt: now, ...(contacted ? { status: 'contatada' as const } : {}) })
    .where(eq(businesses.id, business.id));

  const today = saoPauloParts(now).day;
  const state = await getAppState();
  if (state.sentDay !== today) {
    await updateAppState({ sentDay: today, sentCount: 1 });
  } else {
    await db
      .update(appState)
      .set({ sentCount: sql`${appState.sentCount} + 1`, updatedAt: now })
      .where(eq(appState.id, 1));
  }
  const what = message.kind === 'follow_up' ? 'Lembrete enviado' : 'Primeira mensagem enviada';
  await logEvent('mensagem', `${what} pelo celular para ${business.name}.`, business.id);
  return { ok: true, message: 'Marcada como enviada.' };
}

/** A dona colou no painel a mensagem que a empresa mandou no WhatsApp. */
export async function registerInboundMessage(
  businessId: string,
  text: string,
  now: Date,
): Promise<Result & { optOut: boolean }> {
  const body = text.trim();
  if (!body) return { ok: false, optOut: false, message: 'Cole a mensagem que a empresa mandou.' };
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) return { ok: false, optOut: false, message: 'Empresa não encontrada.' };

  await db.insert(messages).values({ businessId, direction: 'in', kind: 'recebida', body, status: 'recebida', sentAt: now });
  if (isOptOut(body)) {
    await optOutBusiness(businessId, now, { confirm: false });
    return { ok: true, optOut: true, message: 'Ela pediu para não receber mais mensagens. O número foi bloqueado.' };
  }
  await db
    .update(businesses)
    .set({ lastInboundAt: now, updatedAt: now, ...(REPLIED_FROM.has(business.status) ? { status: 'respondeu' as const } : {}) })
    .where(eq(businesses.id, businessId));
  await logEvent('resposta', `${business.name} respondeu: "${body.slice(0, 80)}"`, businessId);
  return { ok: true, optOut: false, message: 'Resposta salva.' };
}

/** Mensagem que a dona mandou pelo celular, escrita por ela ou sugerida pela IA. */
export async function recordManualSend(businessId: string, text: string, kind: 'manual' | 'ia', now: Date): Promise<Result> {
  const body = text.trim();
  if (!body) return { ok: false, message: 'Escreva a mensagem.' };
  const db = getDb();
  await db.insert(messages).values({ businessId, direction: 'out', kind, body, status: 'enviada', sentAt: now });
  await db
    .update(businesses)
    .set({
      lastOutboundAt: now,
      updatedAt: now,
      ...(kind === 'ia' ? { aiReplyCount: sql`${businesses.aiReplyCount} + 1` } : {}),
    })
    .where(eq(businesses.id, businessId));
  return { ok: true, message: 'Mensagem registrada.' };
}

export type Suggestion =
  | { ok: true; reply: string; intent: ReplyIntent; handoff: boolean }
  | { ok: false; message: string };

/** A IA lê a conversa e sugere a próxima resposta. Quem envia é a dona. */
export async function suggestReply(businessId: string): Promise<Suggestion> {
  if (!isConfigured('gemini')) return { ok: false, message: 'Configure GEMINI_API_KEY para a IA sugerir respostas.' };
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) return { ok: false, message: 'Empresa não encontrada.' };
  try {
    const decision = await generateReply(await buildReplyContext(business, await getSettings()));
    if (decision.intent === 'interessado' && !['cliente', 'interessada'].includes(business.status)) {
      await db.update(businesses).set({ status: 'interessada', updatedAt: new Date() }).where(eq(businesses.id, businessId));
      await logEvent('atencao', `${business.name} quer fechar o site.`, businessId);
    }
    return { ok: true, ...decision };
  } catch (error) {
    return {
      ok: false,
      message: `A IA não respondeu agora (${errorMessage(error).slice(0, 120)}). Tente de novo ou escreva você mesma.`,
    };
  }
}
