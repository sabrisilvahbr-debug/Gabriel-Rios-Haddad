import { describe, expect, it } from 'vitest';
import { GET } from '@/app/robots.txt/route';

const request = (host: string) => new Request('https://example.test/robots.txt', { headers: { host } });

describe('robots.txt', () => {
  it('hides previews and the panel on the app host', async () => {
    const body = await GET(request('zap.vercel.app')).text();
    expect(body).toContain('Disallow: /s/');
    expect(body).toContain('Disallow: /painel');
  });

  it('allows everything and points to the sitemap on a client domain', async () => {
    const body = await GET(request('padaria.com.br')).text();
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://padaria.com.br/sitemap.xml');
  });
});
