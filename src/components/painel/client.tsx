'use client';

import { Check, Copy } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/action-result';
import { buttonClass } from './ui';

type Action = (state: ActionResult, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Salvando…',
  variant = 'primary',
  confirmMessage,
  className,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: keyof typeof buttonClass;
  confirmMessage?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass[variant]}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.message ? (
          <p role="status" className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Atualiza a página de tempos em tempos enquanto houver algo em andamento. */
export function AutoRefresh({ active, seconds = 10 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [active, seconds, router]);
  return null;
}

export function CopyButton({ value, label = 'Copiar link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? 'Copiado' : label}
    </button>
  );
}

const NAV = [
  { href: '/painel', label: 'Início' },
  { href: '/painel/buscas', label: 'Buscas' },
  { href: '/painel/empresas', label: 'Empresas' },
  { href: '/painel/whatsapp', label: 'WhatsApp' },
  { href: '/painel/configuracoes', label: 'Configurações' },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel" className="flex gap-1 overflow-x-auto lg:flex-col">
      {NAV.map((item) => {
        const active = item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-emerald-50 text-emerald-900' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
