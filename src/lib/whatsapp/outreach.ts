import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { errorMessage } from '@/lib/async';
import { isBlocked } from '@/lib/blocklist';
import { BUSINESS_STATUS_LABELS } from '@/lib/constants';
import { getDb } from '@/lib/db/client';
import { appState, businesses, messages, sites, type Business, type Message, type Settings } from '@/lib/db/schema';
import { getAppState, getSettings, updateAppState } from '@/lib/db/settings';
import { appUrl, isConfigured } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { waNumber } from '@/lib/phone';
import { saoPauloParts } from '@/lib/time';
import { checkWhatsappNumber, sendText } from './evolution';
import { isWithinWindow, nextDelayMs } from './schedule';
import { DEFAULT_FIRST_TEMPLATES, pickTemplate, renderTemplate, type TemplateVars } from './templates';

type Result = { ok: boolean; message: string };
export type StepResult = { result: 'sent' | 'skipped' | 'idle' | 'error'; reason: string };

const NOT_CONTACTABLE = new Set(['nao_contatar', 'sem_whatsapp', 'cliente', 'descartada']);
const ERROR_BACKOFF_MS = 15 * 60_000;

async function getBusiness(id: string): Promise<Business | null> {
  const [row] = await getDb().select().from(businesses).where(eq(businesses.id, id)).limit(1);
  return row ?? null;
}

async function templateVars(business: Business, settings: Settings): Promise<TemplateVars | null> {
  const [site] = await getDb().select({ slug: sites.slug }).from(sites).where(eq(sites.businessId, business.id)).limit(1);
  if (!site) return null;
  return {
    empresa: business.name,
    link: `${appUrl()}/s/${site.slug}`,
    agencia: settings.agencyName,
    cidade: business.city || 'sua cidade',
    ramo: business.category ? business.category.toLowerCase() : 'seu ramo',
  };
}

export async function enqueueFirstContact(businessId: string): Promise<Result> {
  const settings = await getSettings();
  if (!settings.agencyName) return { ok: false, message: 'Coloque o nome da sua agência em Configurações antes de enviar.' };
  const business = await getBusiness(businessId);
  if (!business) return { ok: false, message: 'Empresa não encontrada.' };
  if (NOT_CONTACTABLE.has(business.status)) {
    return { ok: false, message: `Esta empresa está como "${BUSINESS_STATUS_LABELS[business.status]}".` };
  }
  if (!business.phoneIsMobile) return { ok: false, message: 'Esta empresa só tem telefone fixo, sem WhatsApp.' };
  if (await isBlocked(business.phoneE164)) return { ok: false, message: 'Este telefone pediu para não receber mensagens.' };

  const [existing] = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.businessId, businessId),
        eq(messages.kind, 'primeiro_contato'),
        inArray(messages.status, ['agendada', 'enviada']),
      ),
    )
    .limit(1);
  if (existing) return { ok: false, message: 'Esta empresa já recebeu a primeira mensagem ou já está na fila.' };

  const vars = await templateVars(business, settings);
  if (!vars) return { ok: false, message: 'A prévia desta empresa ainda não está pronta.' };
  const templates = settings.messageTemplates.length ? settings.messageTemplates : DEFAULT_FIRST_TEMPLATES;

  await getDb().insert(messages).values({
    businessId,
    direction: 'out',
    kind: 'primeiro_contato',
    body: renderTemplate(pickTemplate(templates), vars),
    status: 'agendada',
  });
  await getDb().update(businesses).set({ status: 'na_fila', updatedAt: new Date() }).where(eq(businesses.id, businessId));
  return { ok: true, message: 'Na fila de envio.' };
}

/** Coloca na fila todas as prévias prontas com celular. Devolve quantas entraram. */
export async function enqueueAllReady(): Promise<number> {
  const ready = await getDb()
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.status, 'previa_pronta'), eq(businesses.phoneIsMobile, true)))
    .orderBy(asc(businesses.createdAt));
  let queued = 0;
  for (const { id } of ready) {
    if ((await enqueueFirstContact(id)).ok) queued++;
  }
  if (queued) await logEvent('fila', `${queued} empresa(s) colocada(s) na fila de envio.`);
  return queued;
}

export async function cancelQueued(businessId: string): Promise<void> {
  await getDb()
    .update(messages)
    .set({ status: 'cancelada' })
    .where(and(eq(messages.businessId, businessId), eq(messages.status, 'agendada')));
  await getDb()
    .update(businesses)
    .set({ status: 'previa_pronta', updatedAt: new Date() })
    .where(and(eq(businesses.id, businessId), eq(businesses.status, 'na_fila')));
}

async function nextQueued(): Promise<Message | null> {
  const [message] = await getDb()
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.direction, 'out'),
        eq(messages.status, 'agendada'),
        inArray(messages.kind, ['primeiro_contato', 'follow_up']),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(1);
  return message ?? null;
}

const skipped = (reason: string): StepResult => ({ result: 'skipped', reason });

/** Envia no máximo uma mensagem da fila, respeitando ligação, janela, limite e intervalo. */
export async function runOutreachStep(now: Date): Promise<StepResult> {
  const settings = await getSettings();
  if (!settings.outreachEnabled) return skipped('envio desligado');
  if (!isConfigured('whatsapp')) return skipped('WhatsApp não configurado');
  if (!isWithinWindow(now, settings)) return skipped('fora do horário de envio');

  let state = await getAppState();
  if (state.waConnectionState !== 'open') return skipped('WhatsApp desconectado');
  const today = saoPauloParts(now).day;
  if (state.sentDay !== today) state = await updateAppState({ sentDay: today, sentCount: 0 });
  if (state.sentCount >= settings.dailyLimit) return skipped('limite do dia atingido');
  if (state.nextSendAfter && state.nextSendAfter > now) return skipped('aguardando o intervalo');

  const message = await nextQueued();
  if (!message) return { result: 'idle', reason: 'fila vazia' };
  const db = getDb();
  const business = await getBusiness(message.businessId);
  if (!business || NOT_CONTACTABLE.has(business.status) || (await isBlocked(business.phoneE164))) {
    await db.update(messages).set({ status: 'cancelada', error: 'Empresa não pode mais ser contatada.' }).where(eq(messages.id, message.id));
    return skipped('empresa não pode mais ser contatada');
  }

  try {
    let number = business.waJid?.split('@')[0] ?? waNumber(business.phoneE164);
    if (business.whatsappStatus !== 'yes') {
      const check = await checkWhatsappNumber(waNumber(business.phoneE164));
      if (!check.exists) {
        await db
          .update(businesses)
          .set({ whatsappStatus: 'no', status: 'sem_whatsapp', updatedAt: now })
          .where(eq(businesses.id, business.id));
        await db.update(messages).set({ status: 'cancelada', error: 'Número sem WhatsApp.' }).where(eq(messages.id, message.id));
        await logEvent('sem_whatsapp', `${business.name} não tem WhatsApp nesse número.`, business.id);
        return skipped('número sem WhatsApp');
      }
      number = check.jid?.split('@')[0] ?? number;
      await db
        .update(businesses)
        .set({ whatsappStatus: 'yes', waJid: check.jid, updatedAt: now })
        .where(eq(businesses.id, business.id));
    }

    const sent = await sendText(number, message.body);
    await db.update(messages).set({ status: 'enviada', waMessageId: sent.id, sentAt: now, error: null }).where(eq(messages.id, message.id));
    await db
      .update(businesses)
      .set({
        lastOutboundAt: now,
        updatedAt: now,
        ...(message.kind === 'primeiro_contato' ? { status: 'contatada' as const } : {}),
      })
      .where(eq(businesses.id, business.id));
    await db
      .update(appState)
      .set({ sentCount: sql`${appState.sentCount} + 1`, nextSendAfter: new Date(now.getTime() + nextDelayMs(settings)), updatedAt: now })
      .where(eq(appState.id, 1));
    const what = message.kind === 'follow_up' ? 'Lembrete enviado' : 'Primeira mensagem enviada';
    await logEvent('mensagem', `${what} para ${business.name}.`, business.id);
    return { result: 'sent', reason: business.name };
  } catch (error) {
    await db.update(messages).set({ status: 'erro', error: errorMessage(error) }).where(eq(messages.id, message.id));
    await updateAppState({ nextSendAfter: new Date(now.getTime() + ERROR_BACKOFF_MS) });
    await logEvent('erro', `Falha ao enviar para ${business.name}: ${errorMessage(error)}`, business.id);
    return { result: 'error', reason: errorMessage(error) };
  }
}

/** Agenda um único lembrete para quem não respondeu depois de N dias. */
export async function scheduleFollowUps(now: Date): Promise<number> {
  const settings = await getSettings();
  if (!settings.followUpEnabled || !settings.followUpTemplate.trim()) return 0;
  const cutoff = new Date(now.getTime() - settings.followUpAfterDays * 86_400_000);
  const candidates = await getDb()
    .select()
    .from(businesses)
    .where(and(eq(businesses.status, 'contatada'), lte(businesses.lastOutboundAt, cutoff), isNull(businesses.lastInboundAt)))
    .limit(20);

  let created = 0;
  for (const business of candidates) {
    const [already] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.businessId, business.id), eq(messages.kind, 'follow_up')))
      .limit(1);
    if (already) continue;
    const vars = await templateVars(business, settings);
    if (!vars) continue;
    await getDb()
      .insert(messages)
      .values({
        businessId: business.id,
        direction: 'out',
        kind: 'follow_up',
        body: renderTemplate(settings.followUpTemplate, vars),
        status: 'agendada',
      });
    created++;
  }
  return created;
}

/** Mensagem escrita pela dona no painel: sai na hora e pausa a IA desta conversa. */
export async function sendManualMessage(businessId: string, text: string): Promise<Result> {
  const body = text.trim();
  if (!body) return { ok: false, message: 'Escreva a mensagem.' };
  const business = await getBusiness(businessId);
  if (!business) return { ok: false, message: 'Empresa não encontrada.' };
  if (!business.phoneIsMobile) return { ok: false, message: 'Esta empresa só tem telefone fixo.' };
  const state = await getAppState();
  if (state.waConnectionState !== 'open') return { ok: false, message: 'Conecte o WhatsApp antes de enviar.' };

  const now = new Date();
  try {
    const sent = await sendText(business.waJid?.split('@')[0] ?? waNumber(business.phoneE164), body);
    await getDb().insert(messages).values({
      businessId,
      direction: 'out',
      kind: 'manual',
      body,
      waMessageId: sent.id,
      status: 'enviada',
      sentAt: now,
    });
    await getDb()
      .update(businesses)
      .set({ aiPaused: true, lastOutboundAt: now, updatedAt: now })
      .where(eq(businesses.id, businessId));
    return { ok: true, message: 'Mensagem enviada. A IA ficou pausada nesta conversa.' };
  } catch (error) {
    return { ok: false, message: `Não consegui enviar: ${errorMessage(error)}` };
  }
}
