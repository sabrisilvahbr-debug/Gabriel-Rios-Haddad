import type { Metadata } from 'next';
import { Zap } from 'lucide-react';
import { PanelNav } from '@/components/painel/client';
import { logout } from '@/app/login/actions';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Painel — Zap Business Flow',
  robots: { index: false, follow: false },
};

function LogoutButton({ className }: { className: string }) {
  return (
    <form action={logout} className={className}>
      <button type="submit" className="rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900">
        Sair
      </button>
    </form>
  );
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-screen bg-stone-50 lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-stone-200 bg-white px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:mb-6">
          <div className="flex items-center gap-2 px-1">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-700 text-white">
              <Zap className="size-4" aria-hidden />
            </span>
            <span className="font-semibold text-stone-900">Zap Business Flow</span>
          </div>
          <LogoutButton className="lg:hidden" />
        </div>
        <div className="mt-3 lg:mt-0">
          <PanelNav />
        </div>
        <LogoutButton className="hidden lg:mt-auto lg:block" />
      </aside>
      <main className="px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
