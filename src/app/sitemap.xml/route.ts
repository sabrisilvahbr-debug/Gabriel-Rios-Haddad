import { isAppHost, parseAppHosts } from '@/lib/routing';
import { getPublishedByHost } from '@/lib/sites/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  let urls = '';
  if (!isAppHost(host, parseAppHosts(process.env.APP_HOSTS))) {
    const result = await getPublishedByHost(host);
    if (result && result !== 'manutencao') {
      const lastmod = result.site.updatedAt.toISOString().slice(0, 10);
      urls = `<url><loc>https://${result.site.customDomain}/</loc><lastmod>${lastmod}</lastmod></url>`;
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
