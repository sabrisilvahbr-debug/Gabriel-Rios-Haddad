import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite (banco local de desenvolvimento e testes) usa WebAssembly e arquivos próprios.
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      { source: '/s/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/painel/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  experimental: {
    serverActions: {
      // Fotos de até 5 MB enviadas pelo editor do site.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
