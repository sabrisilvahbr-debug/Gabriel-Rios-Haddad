import { hostWithoutPort, isAppHost, parseAppHosts } from '@/lib/routing';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const body = isAppHost(host, parseAppHosts(process.env.APP_HOSTS))
    ? 'User-agent: *\nDisallow: /s/\nDisallow: /painel\nDisallow: /login\nDisallow: /api/\nDisallow: /dominio/\n'
    : `User-agent: *\nAllow: /\nSitemap: https://${hostWithoutPort(host)}/sitemap.xml\n`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
