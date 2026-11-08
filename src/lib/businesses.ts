import { and, asc, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { errorMessage } from '@/lib/async';
import { blockPhone } from '@/lib/blocklist';
import { removeDomainHosts } from '@/lib/domains/vercel';
import { BUSINESS_STATUS_LABELS, BUSINESS_STATUSES, type BusinessStatus } from '@/lib/constants';
import { getDb } from '@/lib/db/client';
import { businesses, messages, sites, type Business, type Message, type Site } from '@/lib/db/schema';
import { logEvent } from '@/lib/events';

export interface BusinessRow {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number | null;
  status: BusinessStatus;
  phoneDisplay: string;
  slug: string | null;
  siteStatus: Site['status'] | null;
  createdAt: Date;
}

export async function listBusinesses(filter: { status?: string; q?: string } = {}, limit = 200): Promise<BusinessRow[]> {
  const conditions: SQL[] = [];
  if (filter.status && (BUSINESS_STATUSES as readonly string[]).includes(filter.status)) {
    conditions.push(eq(businesses.status, filter.status as BusinessStatus));
  }
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim()}%`;
    const match = or(ilike(businesses.name, term), ilike(businesses.city, term), ilike(businesses.category, term));
    if (match) conditions.push(match);
  }
  return getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      category: businesses.category,
      city: businesses.city,
      rating: businesses.rating,
      status: businesses.status,
      phoneDisplay: businesses.phoneDisplay,
      slug: sites.slug,
      siteStatus: sites.status,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .leftJoin(sites, eq(sites.businessId, businesses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(businesses.createdAt), asc(businesses.name))
    .limit(limit);
}

export async function getBusinessDetail(
  id: string,
): Promise<{ business: Business; site: Site | null; messages: Message[] } | null> {
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  if (!business) return null;
  const [site] = await db.select().from(sites).where(eq(sites.businessId, id)).limit(1);
  const conversation = await db
    .select()
    .from(messages)
    .where(eq(messages.businessId, id))
    .orderBy(asc(messages.createdAt));
  return { business, site: site ?? null, messages: conversation };
}

async function cancelScheduled(businessId: string): Promise<void> {
  await getDb()
    .update(messages)
    .set({ status: 'cancelada' })
    .where(and(eq(messages.businessId, businessId), eq(messages.status, 'agendada')));
}

export async function updateBusinessStatus(id: string, status: BusinessStatus): Promise<void> {
  if (!(BUSINESS_STATUSES as readonly string[]).includes(status)) throw new Error('Status inválido.');
  const [business] = await getDb()
    .update(businesses)
    .set({ status, updatedAt: new Date(), ...(status === 'nao_contatar' ? { optedOutAt: new Date() } : {}) })
    .where(eq(businesses.id, id))
    .returning();
  if (!business) throw new Error('Empresa não encontrada.');
  if (status === 'nao_contatar' || status === 'descartada') {
    await cancelScheduled(id);
  }
  if (status === 'nao_contatar') await blockPhone(business.phoneE164);
  await logEvent('status', `Status de ${business.name} mudou para "${BUSINESS_STATUS_LABELS[status]}".`, id);
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  await getDb()
    .update(businesses)
    .set({ notes: notes.slice(0, 5000), updatedAt: new Date() })
    .where(eq(businesses.id, id));
}

export async function setAiPaused(id: string, paused: boolean): Promise<void> {
  await getDb().update(businesses).set({ aiPaused: paused, updatedAt: new Date() }).where(eq(businesses.id, id));
}

/** Apaga empresa, site, mensagens e histórico (as tabelas filhas caem em cascata). */
export async function deleteBusiness(id: string): Promise<void> {
  const [site] = await getDb()
    .select({ customDomain: sites.customDomain })
    .from(sites)
    .where(eq(sites.businessId, id))
    .limit(1);
  if (site?.customDomain) {
    try {
      await removeDomainHosts(site.customDomain);
    } catch (error) {
      console.warn('[businesses] não consegui remover o domínio na Vercel:', errorMessage(error));
    }
  }
  await getDb().delete(businesses).where(eq(businesses.id, id));
}
