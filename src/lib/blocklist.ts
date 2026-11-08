import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { blockedPhones } from '@/lib/db/schema';
import { hashPhone } from '@/lib/phone';

/** Telefones de quem pediu para sair. Guarda só o hash (LGPD). */
export async function isBlocked(e164: string): Promise<boolean> {
  const rows = await getDb()
    .select({ hash: blockedPhones.phoneHash })
    .from(blockedPhones)
    .where(eq(blockedPhones.phoneHash, hashPhone(e164)))
    .limit(1);
  return rows.length > 0;
}

export async function blockPhone(e164: string): Promise<void> {
  await getDb().insert(blockedPhones).values({ phoneHash: hashPhone(e164) }).onConflictDoNothing();
}
