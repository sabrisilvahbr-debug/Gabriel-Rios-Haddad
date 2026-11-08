import Link from 'next/link';
import { EmptyState, inputClass, PageHeader, StatusBadge, buttonClass } from '@/components/painel/ui';
import { listBusinesses } from '@/lib/businesses';
import { BUSINESS_STATUS_LABELS, BUSINESS_STATUSES } from '@/lib/constants';
import { countByStatus } from '@/lib/panel/stats';

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function BusinessesPage({ searchParams }: Props) {
  const { status, q } = await searchParams;
  const [rows, counts] = await Promise.all([listBusinesses({ status, q }), countByStatus()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabHref = (value?: string) => {
    const params = new URLSearchParams();
    if (value) params.set('status', value);
    if (q) params.set('q', q);
    const query = params.toString();
    return query ? `/painel/empresas?${query}` : '/painel/empresas';
  };

  return (
    <>
      <PageHeader title="Empresas" description="Empresas encontradas nas buscas, com a prévia de site de cada uma." />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrar por etapa">
        <Link
          href={tabHref()}
          aria-current={!status ? 'page' : undefined}
          className={`rounded-full px-3 py-1 text-sm ${!status ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-300'}`}
        >
          Todas ({total})
        </Link>
        {BUSINESS_STATUSES.filter((s) => counts[s] > 0 || s === status).map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={status === s ? 'page' : undefined}
            className={`rounded-full px-3 py-1 text-sm ${status === s ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-300'}`}
          >
            {BUSINESS_STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <form className="mb-6 flex max-w-md gap-2" action="/painel/empresas">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input name="q" defaultValue={q} placeholder="Buscar por nome, ramo ou cidade" className={inputClass} />
        <button type="submit" className={buttonClass.secondary}>
          Buscar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nenhuma empresa aqui">
          {total === 0 ? (
            <>
              Faça uma busca em{' '}
              <Link href="/painel/buscas" className="font-medium text-emerald-800 underline">
                Buscas
              </Link>{' '}
              para começar.
            </>
          ) : (
            'Tente outro filtro.'
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Cidade</th>
                <th className="px-4 py-3 text-right font-medium">Nota</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Prévia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/painel/empresas/${row.id}`} className="font-medium text-stone-900 hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-stone-500">{row.category}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-700">{row.city}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {row.rating !== null ? row.rating.toFixed(1).replace('.', ',') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.slug ? (
                      <a href={`/s/${row.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClass.link}>
                        Abrir
                      </a>
                    ) : (
                      <span className="text-stone-400">Gerando</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
