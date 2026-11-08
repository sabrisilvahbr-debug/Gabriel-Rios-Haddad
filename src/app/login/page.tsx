import type { Metadata } from 'next';
import { Zap } from 'lucide-react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Entrar — Zap Business Flow',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white">
            <Zap className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">Zap Business Flow</p>
            <p className="text-sm text-slate-500">Entre para abrir o painel</p>
          </div>
        </div>
        <LoginForm next={next ?? '/painel'} />
      </div>
    </main>
  );
}
