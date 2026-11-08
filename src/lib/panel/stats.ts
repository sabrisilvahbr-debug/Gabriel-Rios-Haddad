import { count } from 'drizzle-orm';
import { BUSINESS_STATUSES, type BusinessStatus } from '@/lib/constants';
import { getDb } from '@/lib/db/client';
import { businesses } from '@/lib/db/schema';

export async function countByStatus(): Promise<Record<BusinessStatus, number>> {
  const rows = await getDb()
    .select({ status: businesses.status, total: count() })
    .from(businesses)
    .groupBy(businesses.status);
  const result = Object.fromEntries(BUSINESS_STATUSES.map((s) => [s, 0])) as Record<BusinessStatus, number>;
  for (const row of rows) result[row.status] = Number(row.total);
  return result;
}
