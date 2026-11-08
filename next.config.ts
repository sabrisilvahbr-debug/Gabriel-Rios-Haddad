import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite (banco local de desenvolvimento e testes) usa WebAssembly e arquivos próprios.
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    serverActions: {
      // Fotos de até 5 MB enviadas pelo editor do site.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
