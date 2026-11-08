'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buttonClass } from './ui';

export type SendRegistration = { messageId: string } | { businessId: string; text: string; kind: 'manual' | 'ia' };

const REGISTER_URL = '/api/whatsapp/registrar';

/** Avisa o painel que a mensagem foi aberta no WhatsApp. sendBeacon sobrevive à troca de app no celular. */
function register(registration: SendRegistration) {
  const body = JSON.stringify(registration);
  const queued =
    typeof navigator.sendBeacon === 'function' &&
    navigator.sendBeacon(REGISTER_URL, new Blob([body], { type: 'application/json' }));
  if (!queued) {
    void fetch(REGISTER_URL, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true });
  }
}

/** Modo celular: abre o WhatsApp com a mensagem pronta e marca como enviada. */
export function SendOnWhatsApp({
  href,
  registration,
  label = 'Enviar no WhatsApp',
  disabled = false,
}: {
  href: string;
  registration: SendRegistration;
  label?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const refreshWhenBack = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', refreshWhenBack);
    const timer = window.setTimeout(() => router.refresh(), 2000);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenBack);
      window.clearTimeout(timer);
    };
  }, [opened, router]);

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${buttonClass.primary} pointer-events-none opacity-50`}>
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass.primary}
      onClick={() => {
        register(registration);
        setOpened(true);
      }}
    >
      {opened ? 'Abrindo o WhatsApp…' : label}
    </a>
  );
}
