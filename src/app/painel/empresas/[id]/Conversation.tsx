import { ActionForm } from '@/components/painel/client';
import { inputClass, Section } from '@/components/painel/ui';
import type { Business, Message } from '@/lib/db/schema';
import { formatDateTimePt } from '@/lib/time';
import { cancelQueueOneAction, enqueueOneAction, sendManualAction, toggleAiAction } from './actions';

const KIND_LABELS: Record<Message['kind'], string> = {
  primeiro_contato: 'Primeira mensagem',
  follow_up: 'Lembrete',
  ia: 'Resposta da IA',
  manual: 'Você',
  sistema: 'Automática',
  recebida: '',
  auto_resposta: 'Resposta automática da empresa',
};

const STATUS_LABELS: Record<Message['status'], string> = {
  agendada: 'na fila',
  enviada: 'enviada',
  erro: 'erro',
  cancelada: 'cancelada',
  recebida: '',
};

export function Conversation({ business, messages }: { business: Business; messages: Message[] }) {
  const businessId = <input type="hidden" name="businessId" value={business.id} />;
  const firstContact = messages.find((m) => m.kind === 'primeiro_contato' && (m.status === 'agendada' || m.status === 'enviada'));
  const canEnqueue = !firstContact && (business.status === 'previa_pronta' || business.status === 'nova') && business.phoneIsMobile;

  return (
    <Section
      title="Conversa no WhatsApp"
      description={
        business.aiPaused
          ? 'IA pausada nesta conversa: só você responde.'
          : `A IA responde quando ligada em Configurações (${business.aiReplyCount} resposta(s) até agora).`
      }
    >
      {messages.length === 0 ? (
        <p className="mb-5 text-sm text-stone-600">Nenhuma mensagem ainda.</p>
      ) : (
        <ol className="mb-5 space-y-3">
          {messages.map((message) => {
            const outgoing = message.direction === 'out';
            return (
              <li key={message.id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    outgoing ? 'rounded-br-sm bg-emerald-50 text-stone-900' : 'rounded-bl-sm border border-stone-200 bg-white'
                  } ${message.status === 'cancelada' ? 'opacity-50' : ''}`}
                >
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {[KIND_LABELS[message.kind], STATUS_LABELS[message.status], formatDateTimePt(message.sentAt ?? message.createdAt)]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {message.error ? <p className="mt-1 text-xs text-red-700">{message.error}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap gap-3">
        {canEnqueue ? (
          <ActionForm action={enqueueOneAction} submitLabel="Colocar primeira mensagem na fila" pendingLabel="Colocando…">
            {businessId}
          </ActionForm>
        ) : null}
        {business.status === 'na_fila' ? (
          <ActionForm action={cancelQueueOneAction} submitLabel="Tirar da fila" pendingLabel="Tirando…" variant="secondary">
            {businessId}
          </ActionForm>
        ) : null}
        <ActionForm
          action={toggleAiAction}
          submitLabel={business.aiPaused ? 'Retomar IA nesta conversa' : 'Pausar IA nesta conversa'}
          pendingLabel="Salvando…"
          variant="secondary"
        >
          {businessId}
          <input type="hidden" name="paused" value={business.aiPaused ? 'false' : 'true'} />
        </ActionForm>
      </div>

      {business.phoneIsMobile ? (
        <div className="mt-5 border-t border-stone-100 pt-5">
          <ActionForm action={sendManualAction} submitLabel="Enviar agora" pendingLabel="Enviando…" className="space-y-3">
            {businessId}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Responder você mesma</span>
              <textarea name="text" rows={3} required className={inputClass} />
              <span className="mt-1 block text-xs text-stone-500">Ao responder por aqui ou pelo celular, a IA pausa nesta conversa.</span>
            </label>
          </ActionForm>
        </div>
      ) : null}
    </Section>
  );
}
