import { and, asc, count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { ActionForm } from '@/components/painel/client';
import { Callout, PageHeader, Section } from '@/components/painel/ui';
import { getDb } from '@/lib/db/client';
import { businesses, messages } from '@/lib/db/schema';
import { getAppState, getSettings } from '@/lib/db/settings';
import { integrationStatus } from '@/lib/env';
import { formatDateTimePt, saoPauloParts } from '@/lib/time';
import { cancelQueuedAction } from './actions';
import { ConnectCard } from './ConnectCard';

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export default async function WhatsappPage() {
  const [settings, state] = await Promise.all([getSettings(), getAppState()]);
  const integration = integrationStatus().find((i) => i.key === 'whatsapp')!;
  const cron = integrationStatus().find((i) => i.key === 'cron')!;
  const db = getDb();
  const queued = and(eq(messages.direction, 'out'), eq(messages.status, 'agendada'));
  const [[{ total }], next] = await Promise.all([
    db.select({ total: count() }).from(messages).where(queued),
    db
      .select({ id: messages.id, kind: messages.kind, businessId: businesses.id, name: businesses.name })
      .from(messages)
      .innerJoin(businesses, eq(businesses.id, messages.businessId))
      .where(queued)
      .orderBy(asc(messages.createdAt))
      .limit(10),
  ]);
  const today = saoPauloParts(new Date()).day;
  const sentToday = state.sentDay === today ? state.sentCount : 0;
  const days = settings.windowDays
    .split(',')
    .map((d) => DAY_NAMES[Number(d)])
    .join(', ');
  const waState = (['open', 'close', 'connecting'] as const).find((s) => s === state.waConnectionState) ?? 'unknown';

  return (
    <>
      <PageHeader title="WhatsApp" description="Conecte o número que vai enviar as mensagens e acompanhe a fila." />

      <div className="space-y-4">
        {!integration.ok ? (
          <Callout tone="red">
            Falta configurar: <code>{integration.missing.join(', ')}</code>. Veja o passo a passo do Railway no README.
          </Callout>
        ) : null}
        {!cron.ok ? (
          <Callout>Sem CRON_SECRET, a Vercel não chama o agendador e nada sai da fila.</Callout>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Conexão"
          description="Recomendado: use um número separado (outro chip), para não arriscar o seu WhatsApp principal."
        >
          <ConnectCard initialState={waState} configured={integration.ok} />
        </Section>

        <Section title="Envios">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Envio automático</dt>
              <dd className="font-medium">{settings.outreachEnabled ? 'Ligado' : 'Desligado'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Na fila</dt>
              <dd className="font-medium tabular-nums">{total}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Enviadas hoje</dt>
              <dd className="font-medium tabular-nums">
                {sentToday} de {settings.dailyLimit}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Horário</dt>
              <dd className="text-right font-medium">
                {days}, das {settings.windowStartHour}h às {settings.windowEndHour}h
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Próximo envio a partir de</dt>
              <dd className="font-medium tabular-nums">{formatDateTimePt(state.nextSendAfter)}</dd>
            </div>
          </dl>
          <Link href="/painel/configuracoes" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline">
            Mudar ritmo e mensagens
          </Link>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Próximas da fila" description="Saem uma por vez, na ordem em que entraram.">
          {next.length === 0 ? (
            <p className="text-sm text-stone-600">
              A fila está vazia. Em{' '}
              <Link href="/painel/empresas?status=previa_pronta" className="font-medium text-emerald-800 underline">
                Empresas
              </Link>{' '}
              você coloca as prévias prontas na fila.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {next.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <Link href={`/painel/empresas/${item.businessId}`} className="font-medium text-stone-900 hover:underline">
                      {item.name}
                    </Link>
                    <span className="text-stone-500">
                      {item.kind === 'follow_up' ? ' (lembrete)' : ' (primeira mensagem)'}
                    </span>
                  </span>
                  <ActionForm action={cancelQueuedAction} submitLabel="Tirar da fila" pendingLabel="Tirando…" variant="secondary">
                    <input type="hidden" name="businessId" value={item.businessId} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
