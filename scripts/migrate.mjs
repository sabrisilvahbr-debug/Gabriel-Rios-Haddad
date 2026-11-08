// Aplica as migrações do banco. Roda sozinho no build da Vercel.
// Sem DATABASE_URL, só avisa e segue (o build não quebra).
import { mkdirSync } from 'node:fs';

const url = process.env.DATABASE_URL?.trim();
const migrationsFolder = 'drizzle';

if (!url) {
  console.warn('[migrate] DATABASE_URL não definida — migrações puladas.');
  process.exit(0);
}

try {
  if (url.startsWith('pglite:')) {
    const dir = url.slice('pglite:'.length);
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    if (dir && dir !== 'memory') mkdirSync(dir, { recursive: true });
    const client = dir && dir !== 'memory' ? new PGlite(dir) : new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
    await client.close();
  } else {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(drizzle(neon(url)), { migrationsFolder });
  }
  console.log('[migrate] banco atualizado.');
} catch (error) {
  console.error('[migrate] falhou:', error);
  process.exit(1);
}
