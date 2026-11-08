import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { generateReply, type ReplyContext, type ReplyIntent } from '@/lib/ai/responder';
import { errorMessage } from '@/lib/async';
import { getDb } from '@/lib/db/client';
import { businesses, messages, sites, type Business, type Settings } from '@/lib/db/schema';
import { getAppState, getSettings } from '@/lib/db/settings';
import { appUrl, isConfigured } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { waNumber } from '@/lib/phone';
import { sendText } from './evolution';
import { optOutBusiness } from './inbound';

/** Espera um pouco depois da última mensagem para juntar mensagens seguidas numa resposta só. */
const DEBOUNCE_MS = 45_000;
const PER_TICK = 3;
const HISTORY = 20;

const HANDOFF_REASONS: Partial<Record<ReplyIntent, string>> = {
  interessado: 'quer fechar o site',
  quer_humano: 'pediu para falar com você',
};

async function buildContext(business: Business, settings: Settings): Promise<ReplyContext> {
  const db = getDb();
  const [site] = await db.select({ slug: sites.slug }).from(sites).where(eq(sites.businessId, business.id)).limit(1);
  const rows = await db
    .select({ direction: messages.direction, body: messages.body, kind: messages.kind })
    .from(messages)
    .where(
      and(
        eq(messages.businessId, business.id),
        or(eq(messages.direction, 'in'), eq(messages.status, 'enviada')),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY);
  return {
    agencyName: settings.agencyName,
    offerText: settings.offerText,
    businessName: business.name,
    category: business.category,
    city: business.city,
    previewUrl: site ? `${appUrl()}/s/${site.slug}` : appUrl(),
    history: rows.reverse().map((m) => ({
      from: m.direction === 'in' ? ('empresa' as const) : ('nos' as const),
      text: m.kind === 'auto_resposta' ? `(resposta automática) ${m.body}` : m.body,
    })),
  };
}

function numberOf(business: Business): string {
  return business.waJid?.split('@')[0] ?? waNumber(business.phoneE164);
}

async function sendAiMessage(business: Business, body: string, now: Date): Promise<void> {
  const db = getDb();
  const [row] = await db
    .insert(messages)
    .values({ businessId: business.id, direction: 'out', kind: 'ia', body, status: 'agendada' })
    .returning({ id: messages.id });
  try {
    const sent = await sendText(numberOf(business), body);
    await db.update(messages).set({ status: 'enviada', waMessageId: sent.id, sentAt: now }).where(eq(messages.id, row.id));
    await db
      .update(businesses)
      .set({ aiReplyCount: sql`${businesses.aiReplyCount} + 1`, lastOutboundAt: now, updatedAt: now })
      .where(eq(businesses.id, business.id));
  } catch (error) {
    await db.update(messages).set({ status: 'erro', error: errorMessage(error) }).where(eq(messages.id, row.id));
    throw error;
  }
}

/** Pausa a IA nesta conversa e avisa a dona no WhatsApp dela. */
async function handOff(business: Business, reason: string, settings: Settings, now: Date, interested: boolean) {
  await getDb()
    .update(businesses)
    .set({ aiPaused: true, updatedAt: now, ...(interested ? { status: 'interessada' as const } : {}) })
    .where(eq(businesses.id, business.id));
  await logEvent('atencao', `${business.name} ${reason}. A IA pausou; responda você.`, business.id);
  if (!settings.agencyWhatsapp) return;

  const [last] = await getDb()
    .select({ body: messages.body })
    .from(messages)
    .where(and(eq(messages.businessId, business.id), eq(messages.direction, 'in')))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const text = [
    `🔔 ${business.name} ${reason}.`,
    last ? `Última mensagem: "${last.body.slice(0, 200)}"` : '',
    `${appUrl()}/painel/empresas/${business.id}`,
  ]
    .filter(Boolean)
    .join('\n');
  try {
    await sendText(waNumber(settings.agencyWhatsapp), text);
  } catch (error) {
    await logEvent('erro', `Não consegui te avisar no WhatsApp: ${errorMessage(error)}`, business.id);
  }
}

/** Responde até 3 conversas por rodada. Devolve quantas respostas da IA foram enviadas. */
export async function runRepliesStep(now: Date): Promise<number> {
  const settings = await getSettings();
  if (!settings.aiRepliesEnabled || !isConfigured('whatsapp') || !isConfigured('gemini')) return 0;
  if ((await getAppState()).waConnectionState !== 'open') return 0;

  const pending = await getDb()
    .select()
    .from(businesses)
    .where(
      and(
        eq(businesses.aiPaused, false),
        inArray(businesses.status, ['contatada', 'respondeu', 'interessada']),
        isNotNull(businesses.lastInboundAt),
        lte(businesses.lastInboundAt, new Date(now.getTime() - DEBOUNCE_MS)),
        or(isNull(businesses.lastOutboundAt), gt(businesses.lastInboundAt, businesses.lastOutboundAt)),
        ne(businesses.phoneIsMobile, false),
      ),
    )
    .orderBy(asc(businesses.lastInboundAt))
    .limit(PER_TICK);

  let sent = 0;
  for (const business of pending) {
    if (business.aiReplyCount >= settings.aiMaxReplies) {
      await handOff(business, `chegou ao limite de ${settings.aiMaxReplies} respostas da IA`, settings, now, false);
      continue;
    }
    try {
      const decision = await generateReply(await buildContext(business, settings));
      await sendAiMessage(business, decision.reply, now);
      sent++;
      if (decision.intent === 'sem_interesse') {
        await optOutBusiness(business.id, now, { confirm: false });
        continue;
      }
      const reason = HANDOFF_REASONS[decision.intent] ?? (decision.handoff ? 'precisa de você' : null);
      if (reason) await handOff(business, reason, settings, now, decision.intent !== 'outro' || decision.handoff);
    } catch (error) {
      await handOff(business, `ficou sem resposta da IA (${errorMessage(error).slice(0, 120)})`, settings, now, false);
    }
  }
  return sent;
}
