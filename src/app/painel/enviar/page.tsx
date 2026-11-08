import Link from 'next/link';
import { Callout, EmptyState, PageHeader } from '@/components/painel/ui';
import { SendOnWhatsApp } from '@/components/painel/whatsapp';
import { countByStatus } from '@/lib/panel/stats';
import { listSendQueue } from '@/lib/whatsapp/manual';
import { scheduleFollowUps } from '@/lib/whatsapp/outreach';
import { EnqueueReadyForm } from '../empresas/EnqueueReadyForm';

export const dynamic = 'force-dynamic';

export default async function SendPage() {
  const now = new Date();
  await scheduleFollowUps(now); // lembretes vencidos entram na fila de hoje
  const [queue, counts] = await Promise.all([listSendQueue(now), countByStatus()]);

  return (
    <>
      <PageHeader
        title="Enviar"
        description="Mensagens prontas para hoje. Toque em Enviar no WhatsApp, mande a mensagem e volte aqui para a próxima."
      />

      <dl className="mb-6 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-stone-600">Enviadas hoje</dt>
          <dd className="font-semibold tabular-nums text-stone-900">
            {queue.sentToday} de {queue.dailyLimit}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-stone-600">Na fila</dt>
          <dd className="font-semibold tabular-nums text-stone-900">{queue.waiting}</dd>
        </div>
      </dl>

      <Callout>
        Espere alguns minutos entre um envio e outro. Muitas mensagens seguidas para quem não te conhece fazem o WhatsApp
        desconfiar do número.
      </Callout>

      <div className="mt-6">
        {queue.items.length > 0 ? (
          <ol className="space-y-4">
            {queue.items.map((item) => (
              <li key={item.messageId} className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link href={`/painel/empresas/${item.businessId}`} className="font-semibold text-stone-900 hover:underline">
                    {item.businessName}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {item.kind === 'follow_up' ? 'Lembrete' : 'Primeira mensagem'}
                    {item.city ? `, ${item.city}` : ''}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-stone-700">{item.body}</p>
                <div className="mt-4">
                  <SendOnWhatsApp href={item.link} registration={{ messageId: item.messageId }} />
                </div>
              </li>
            ))}
          </ol>
        ) : queue.waiting > 0 && queue.remaining === 0 ? (
          <EmptyState title="Limite de hoje atingido">
            Você já enviou {queue.sentToday} hoje. As próximas ficam para amanhã.
          </EmptyState>
        ) : (
          <EmptyState title="Nada para enviar agora">
            <p className="mb-4">Coloque as prévias prontas na fila para elas aparecerem aqui.</p>
            {counts.previa_pronta > 0 ? (
              <div className="flex justify-center">
                <EnqueueReadyForm ready={counts.previa_pronta} />
              </div>
            ) : (
              <Link href="/painel/buscas" className="font-medium text-emerald-800 underline">
                Fazer uma busca
              </Link>
            )}
          </EmptyState>
        )}
      </div>
    </>
  );
}
