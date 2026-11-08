import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteView } from '@/components/site/SiteView';
import { getPublishedByHost } from '@/lib/sites/service';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host } = await params;
  const result = await getPublishedByHost(decodeURIComponent(host));
  if (!result) return { title: 'Página não encontrada', robots: { index: false } };
  if (result === 'manutencao') return { title: 'Site em manutenção', robots: { index: false } };

  const { business, site } = result;
  const url = `https://${site.customDomain}`;
  const title = business.city ? `${business.name} — ${business.city}` : business.name;
  return {
    title,
    description: site.content.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: site.content.seoDescription,
      url,
      type: 'website',
      locale: 'pt_BR',
      images: site.photos.filter((p) => p.authorized).slice(0, 1).map((p) => p.url),
    },
  };
}

export default async function OfficialSitePage({ params }: Props) {
  const { host } = await params;
  const result = await getPublishedByHost(decodeURIComponent(host));
  if (!result) notFound();
  if (result === 'manutencao') {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold text-stone-900">Site em manutenção</h1>
          <p className="mt-3 text-lg text-stone-600">Estamos fazendo ajustes. Volte em breve.</p>
        </div>
      </main>
    );
  }
  return <SiteView data={result} mode="published" />;
}
