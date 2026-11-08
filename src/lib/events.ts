import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { events, type AppEvent } from '@/lib/db/schema';

/** Registra algo no histórico do painel. Nunca interrompe o fluxo principal. */
export async function logEvent(type: string, message: string, businessId?: string | null): Promise<void> {
  try {
    await getDb()
      .insert(events)
      .values({ type, message, businessId: businessId ?? null });
  } catch (error) {
    console.error('[events] falha ao registrar evento', type, error);
  }
}

export async function recentEvents(limit = 20): Promise<AppEvent[]> {
  return getDb().select().from(events).orderBy(desc(events.createdAt)).limit(limit);
}
