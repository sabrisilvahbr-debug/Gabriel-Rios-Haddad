import Link from 'next/link';
import { Callout, PageHeader, Section, StatusBadge } from '@/components/painel/ui';
import { BUSINESS_STATUSES } from '@/lib/constants';
import { getAppState, getSettings } from '@/lib/db/settings';
import { integrationStatus, isConfigured } from '@/lib/env';
import { recentEvents } from '@/lib/events';
import { countByStatus } from '@/lib/panel/stats';
import { formatDateTimePt, saoPauloParts } from '@/lib/time';
import { listSendQueue } from '@/lib/whatsapp/manual';

const CONNECTION_LABELS: Record<string, string> = {
  open: 'Conectado',
  connecting: 'Conectando',
  close: 'Desconectado',
  unknown: 'Não conectado',
};

export default async function DashboardPage() {
  const [counts, settings, state, events] = await Promise.all([
    countByStatus(),
    getSettings(),
    getAppState(),
    recentEvents(15),
  ]);
  const missing = integrationStatus().filter((i) => !i.ok && !i.optional);
  const automatic = isConfigured('whatsapp');
  const toSend = automatic ? 0 : (await listSendQueue(new Date())).items.length;
  const today = saoPauloParts(new Date()).day;
  const sentToday = state.sentDay === today ? state.sentCount : 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Início" description="Como está a prospecção hoje." />

      <div className="space-y-4">
        {missing.length ? (
          <Callout>
            Falta configurar: {missing.map((m) => m.label).join(', ')}.{' '}
            <Link href="/painel/configuracoes" className="font-medium underline">
              Ver o que falta
            </Link>
          </Callout>
        ) : null}
        {!settings.agencyName || !settings.agencyWhatsapp ? (
          <Callout>
            Coloque o nome da sua agência e o seu WhatsApp em{' '}
            <Link href="/painel/configuracoes" className="font-medium underline">
              Configurações
            </Link>
            . Eles aparecem na faixa das prévias e no botão &quot;Quero este site&quot;.
          </Callout>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Section title="Empresas por etapa" description={`${total} empresa(s) no total.`}>
          {total === 0 ? (
            <p className="text-sm text-stone-600">
              Nenhuma empresa ainda.{' '}
              <Link href="/painel/buscas" className="font-medium text-emerald-800 underline">
                Faça a primeira busca
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {BUSINESS_STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    href={`/painel/empresas?status=${status}`}
                    className="flex items-center justify-between py-2.5 hover:bg-stone-50"
                  >
                    <StatusBadge status={status} />
                    <span className="tabular-nums font-medium text-stone-900">{counts[status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="WhatsApp">
          <dl className="space-y-3 text-sm">
            {automatic ? (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Conexão</dt>
                <dd className="font-medium">{CONNECTION_LABELS[state.waConnectionState] ?? state.waConnectionState}</dd>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Envio</dt>
                <dd className="font-medium">Pelo seu celular</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Envios hoje</dt>
              <dd className="font-medium tabular-nums">
                {sentToday} de {settings.dailyLimit}
              </dd>
            </div>
            {automatic ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-600">Envio automático</dt>
                  <dd className="font-medium">{settings.outreachEnabled ? 'Ligado' : 'Desligado'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-600">Respostas da IA</dt>
                  <dd className="font-medium">{settings.aiRepliesEnabled ? 'Ligadas' : 'Desligadas'}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Prontas para enviar</dt>
                <dd className="font-medium tabular-nums">{toSend}</dd>
              </div>
            )}
          </dl>
          <Link
            href={automatic ? '/painel/whatsapp' : '/painel/enviar'}
            className="mt-4 inline-block text-sm font-medium text-emerald-800 underline"
          >
            {automatic ? 'Abrir WhatsApp' : 'Abrir Enviar'}
          </Link>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Histórico">
          {events.length === 0 ? (
            <p className="text-sm text-stone-600">Nada por aqui ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <time className="shrink-0 tabular-nums text-stone-500">{formatDateTimePt(event.createdAt)}</time>
                  <span className="text-stone-800">
                    {event.businessId ? (
                      <Link href={`/painel/empresas/${event.businessId}`} className="hover:underline">
                        {event.message}
                      </Link>
                    ) : (
                      event.message
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
