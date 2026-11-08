'use client';

import { useState, useTransition } from 'react';
import { ActionForm } from '@/components/painel/client';
import { buttonClass, inputClass } from '@/components/painel/ui';
import { SendOnWhatsApp } from '@/components/painel/whatsapp';
import { whatsappLink } from '@/lib/whatsapp/link';
import { registerReplyAction, suggestReplyAction } from './actions';

const INTENT_HINTS: Record<string, string> = {
  interessado: 'Ela quer fechar! Combine os detalhes e, quando fechar, mude a etapa para Cliente.',
  quer_humano: 'Ela pediu para falar com você. Vale responder com as suas palavras.',
  sem_interesse: 'Parece que não tem interesse. Depois de enviar, mude a etapa para Descartada.',
};

/** Modo celular: guarda a resposta que a empresa mandou e ajuda a responder pelo WhatsApp do celular. */
export function ManualReplyTools({
  businessId,
  phoneDigits,
  queued,
}: {
  businessId: string;
  phoneDigits: string;
  queued: { id: string; body: string } | null;
}) {
  const [text, setText] = useState('');
  const [fromAi, setFromAi] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const body = text.trim();

  function suggest() {
    setError(null);
    startTransition(async () => {
      const result = await suggestReplyAction(businessId);
      if (result.ok) {
        setText(result.reply);
        setFromAi(true);
        setHint(INTENT_HINTS[result.intent] ?? null);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="mt-5 space-y-6 border-t border-stone-100 pt-5">
      {queued ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">A mensagem da fila está pronta.</p>
          <SendOnWhatsApp href={whatsappLink(phoneDigits, queued.body)} registration={{ messageId: queued.id }} />
        </div>
      ) : null}

      <ActionForm
        action={registerReplyAction}
        submitLabel="Salvar resposta"
        pendingLabel="Salvando…"
        variant="secondary"
        className="space-y-3"
      >
        <input type="hidden" name="businessId" value={businessId} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">A empresa respondeu? Cole aqui a mensagem dela</span>
          <textarea name="text" rows={3} required className={inputClass} />
          <span className="mt-1 block text-xs text-stone-500">
            Se ela pedir para não receber mais mensagens, o painel bloqueia o número.
          </span>
        </label>
      </ActionForm>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Sua resposta</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} className={inputClass} />
        </label>
        {hint ? <p className="text-sm text-amber-800">{hint}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={suggest} disabled={pending} className={buttonClass.secondary}>
            {pending ? 'Escrevendo…' : 'Sugerir resposta com IA'}
          </button>
          <SendOnWhatsApp
            href={whatsappLink(phoneDigits, body)}
            registration={{ businessId, text: body, kind: fromAi ? 'ia' : 'manual' }}
            disabled={!body}
          />
        </div>
      </div>
    </div>
  );
}
