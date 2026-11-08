import type { ReactNode } from 'react';
import { BUSINESS_STATUS_LABELS, type BusinessStatus } from '@/lib/constants';

export const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:bg-stone-100';

export const buttonClass = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600',
  link: 'font-medium text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 hover:decoration-emerald-800',
} as const;

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-stone-600">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-stone-600">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

export function Callout({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'emerald'; children: ReactNode }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

const STATUS_TONES: Record<BusinessStatus, string> = {
  nova: 'bg-stone-100 text-stone-700',
  previa_pronta: 'bg-sky-100 text-sky-800',
  na_fila: 'bg-amber-100 text-amber-800',
  contatada: 'bg-indigo-100 text-indigo-800',
  respondeu: 'bg-violet-100 text-violet-800',
  interessada: 'bg-emerald-100 text-emerald-800',
  cliente: 'bg-emerald-700 text-white',
  descartada: 'bg-stone-200 text-stone-600',
  nao_contatar: 'bg-red-100 text-red-800',
  sem_whatsapp: 'bg-orange-100 text-orange-800',
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[status]}`}>
      {BUSINESS_STATUS_LABELS[status]}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {children ? <div className="mt-2 text-sm text-stone-600">{children}</div> : null}
    </div>
  );
}
