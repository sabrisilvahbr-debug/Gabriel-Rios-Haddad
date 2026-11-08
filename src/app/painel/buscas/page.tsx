import { ActionForm, AutoRefresh } from '@/components/painel/client';
import { Callout, EmptyState, Field, inputClass, PageHeader, Section } from '@/components/painel/ui';
import { listSearches } from '@/lib/apify/import';
import { MAX_RESULTS_LIMIT } from '@/lib/constants';
import type { Search } from '@/lib/db/schema';
import { getSettings } from '@/lib/db/settings';
import { isConfigured } from '@/lib/env';
import { formatDateTimePt } from '@/lib/time';
import { refreshSearchAction, startSearchAction } from './actions';

const STATUS: Record<Search['status'], { label: string; tone: string }> = {
  running: { label: 'Buscando', tone: 'bg-amber-100 text-amber-800' },
  succeeded: { label: 'Importando', tone: 'bg-sky-100 text-sky-800' },
  imported: { label: 'Concluída', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Falhou', tone: 'bg-red-100 text-red-800' },
};

export default async function SearchesPage() {
  const [searches, settings] = await Promise.all([listSearches(), getSettings()]);
  const active = searches.some((s) => s.status === 'running' || s.status === 'succeeded');

  return (
    <>
      <AutoRefresh active={active} seconds={15} />
      <PageHeader
        title="Buscas"
        description="Encontre empresas sem site num ramo e numa cidade. Cada empresa nova ganha uma prévia de site."
      />

      {!isConfigured('apify') ? (
        <div className="mb-6">
          <Callout tone="red">Configure APIFY_TOKEN e APIFY_WEBHOOK_SECRET na Vercel para poder buscar.</Callout>
        </div>
      ) : null}

      <Section title="Nova busca">
        <ActionForm action={startSearchAction} submitLabel="Buscar empresas" pendingLabel="Iniciando…" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
            <Field label="Ramo" hint="Como você procuraria no Google Maps. Ex.: barbearia, pizzaria, pet shop.">
              <input name="term" required maxLength={80} placeholder="barbearia" className={inputClass} />
            </Field>
            <Field label="Cidade" hint="Cidade e estado. Pode incluir o bairro.">
              <input name="location" required maxLength={120} placeholder="Campinas, SP" className={inputClass} />
            </Field>
            <Field label="Quantidade" hint={`Até ${MAX_RESULTS_LIMIT}.`}>
              <input
                name="maxResults"
                type="number"
                min={1}
                max={MAX_RESULTS_LIMIT}
                defaultValue={settings.defaultMaxResults}
                className={inputClass}
              />
            </Field>
          </div>
        </ActionForm>
      </Section>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Buscas recentes</h2>
        {searches.length === 0 ? (
          <EmptyState title="Nenhuma busca ainda">Comece pelo ramo que você mais quer atender.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ramo e cidade</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 text-right font-medium">Encontradas</th>
                  <th className="px-4 py-3 text-right font-medium">Novas</th>
                  <th className="px-4 py-3 font-medium">Início</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {searches.map((search) => (
                  <tr key={search.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{search.term}</p>
                      <p className="text-stone-500">{search.location}</p>
                      {search.error ? <p className="mt-1 max-w-md text-xs text-red-700">{search.error}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[search.status].tone}`}>
                        {STATUS[search.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{search.foundCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{search.importedCount}</td>
                    <td className="px-4 py-3 tabular-nums text-stone-600">{formatDateTimePt(search.createdAt)}</td>
                    <td className="px-4 py-3">
                      {search.status === 'running' || search.status === 'succeeded' ? (
                        <ActionForm action={refreshSearchAction} submitLabel="Atualizar" pendingLabel="Conferindo…" variant="secondary">
                          <input type="hidden" name="id" value={search.id} />
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
