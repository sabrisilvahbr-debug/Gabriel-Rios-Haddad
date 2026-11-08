'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { buttonClass } from '@/components/painel/ui';
import { connectAction, disconnectAction } from './actions';

type State = 'open' | 'close' | 'connecting' | 'unknown';

const LABELS: Record<State, string> = {
  open: 'Conectado',
  connecting: 'Conectando',
  close: 'Desconectado',
  unknown: 'Não conectado',
};

export function ConnectCard({ initialState, configured }: { initialState: State; configured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!polling) return;
    const poll = async () => {
      const response = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as { state?: State; qr?: string | null; error?: string } | null;
      if (!data) return;
      if (data.error) setMessage(data.error);
      if (data.state) setState(data.state);
      setQr(data.qr ?? null);
      if (data.state === 'open') {
        setPolling(false);
        setMessage('WhatsApp conectado.');
        router.refresh();
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [polling, router]);

  return (
    <div>
      <p className="text-sm text-stone-600">
        Situação: <strong className="text-stone-900">{LABELS[state]}</strong>
      </p>

      {qr && state !== 'open' ? (
        <div className="mt-4 inline-block rounded-xl border border-stone-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code para conectar o WhatsApp" className="size-64" />
          <p className="mt-2 max-w-64 text-xs text-stone-600">
            No celular: WhatsApp, Configurações, Aparelhos conectados, Conectar um aparelho. O código muda a cada poucos
            segundos.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state === 'open' ? (
          <button
            type="button"
            disabled={pending}
            className={buttonClass.danger}
            onClick={() => {
              if (!window.confirm('Desconectar o WhatsApp? Os envios param até você conectar de novo.')) return;
              startTransition(async () => {
                const result = await disconnectAction();
                setMessage(result?.message ?? null);
                if (result?.ok) setState('close');
              });
            }}
          >
            Desconectar
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !configured}
            className={buttonClass.primary}
            onClick={() =>
              startTransition(async () => {
                const result = await connectAction();
                setMessage(result?.message ?? null);
                if (result?.ok) setPolling(true);
              })
            }
          >
            {pending ? 'Preparando…' : polling ? 'Gerar novo QR code' : 'Conectar WhatsApp'}
          </button>
        )}
        {message ? <p role="status" className="text-sm text-stone-700">{message}</p> : null}
      </div>
    </div>
  );
}
