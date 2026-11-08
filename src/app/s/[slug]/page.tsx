import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { SiteView } from '@/components/site/SiteView';
import { getPreviewBySlug } from '@/lib/sites/service';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPreviewBySlug(slug);
  const robots = { index: false, follow: false };
  if (!data) return { title: 'Prévia não encontrada', robots };
  return {
    title: `${data.business.name} — prévia do site`,
    description: data.site.content.seoDescription,
    robots,
  };
}

export default async function PreviewPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPreviewBySlug(slug);
  if (!data) notFound();
  if (data.site.status === 'publicado' && data.site.customDomain) {
    permanentRedirect(`https://${data.site.customDomain}`);
  }
  return <SiteView data={data} mode="preview" />;
}
