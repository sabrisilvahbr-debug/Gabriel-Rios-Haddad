import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { errorMessage } from '@/lib/async';
import { getDb } from '@/lib/db/client';
import { appState } from '@/lib/db/schema';
import { getAppState, updateAppState } from '@/lib/db/settings';
import { isConfigured } from '@/lib/env';
import { checkPendingDomains } from '@/lib/sites/publish';
import { runOutreachStep, scheduleFollowUps, type StepResult } from '@/lib/whatsapp/outreach';
import { runRepliesStep } from '@/lib/whatsapp/replies';

const LOCK_MS = 55_000;
const DOMAIN_CHECK_EVERY_MS = 10 * 60_000;

export interface TickReport {
  locked: boolean;
  followUps: number;
  outreach: StepResult | null;
  replies: number;
  domains: boolean;
  errors: string[];
}

/** Uma rodada do agendador (cron a cada minuto). Duas rodadas ao mesmo tempo: só uma trabalha. */
export async function runTick(now: Date = new Date()): Promise<TickReport> {
  const report: TickReport = { locked: false, followUps: 0, outreach: null, replies: 0, domains: false, errors: [] };
  await getAppState();
  const [acquired] = await getDb()
    .update(appState)
    .set({ tickLockedUntil: new Date(now.getTime() + LOCK_MS) })
    .where(and(eq(appState.id, 1), or(isNull(appState.tickLockedUntil), lt(appState.tickLockedUntil, now))))
    .returning({ id: appState.id });
  if (!acquired) return { ...report, locked: true };

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      report.errors.push(`${name}: ${errorMessage(error)}`);
      console.error(`[tick] ${name}:`, error);
    }
  };

  try {
    await step('lembretes', async () => {
      report.followUps = await scheduleFollowUps(now);
    });
    await step('envio', async () => {
      report.outreach = await runOutreachStep(now);
    });
    await step('respostas', async () => {
      report.replies = await runRepliesStep(now);
    });
    await step('domínios', async () => {
      const state = await getAppState();
      const due = !state.lastDomainCheckAt || now.getTime() - state.lastDomainCheckAt.getTime() >= DOMAIN_CHECK_EVERY_MS;
      if (due && isConfigured('dominios')) {
        await checkPendingDomains();
        await updateAppState({ lastDomainCheckAt: now });
        report.domains = true;
      }
    });
  } finally {
    await updateAppState({ tickLockedUntil: null });
  }
  return report;
}
