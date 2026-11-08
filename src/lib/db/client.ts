import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { mkdirSync } from 'node:fs';
import { env } from '@/lib/env';
import * as schema from './schema';

/**
 * Tipo único do banco. Em produção é o driver neon-http; em desenvolvimento e testes,
 * PGlite (mesma API de consulta do Drizzle). Sem transações interativas: use comandos atômicos.
 */
export type DB = NeonHttpDatabase<typeof schema>;

// Guardado em globalThis: o Next.js carrega este módulo em mais de um pacote (páginas, rotas de API)
// no mesmo processo. Com o banco embutido (PGlite), duas instâncias no mesmo diretório se corrompem.
const shared = globalThis as unknown as { __zbfDb?: DB };
let testOverride: DB | null = null;

export function setDbForTests(db: DB | null): void {
  testOverride = db;
}

export function getDb(): DB {
  if (testOverride) return testOverride;
  if (shared.__zbfDb) return shared.__zbfDb;

  const url = env('DATABASE_URL');
  if (url.startsWith('pglite:')) {
    const dir = url.slice('pglite:'.length);
    if (dir && dir !== 'memory') mkdirSync(dir, { recursive: true });
    const client = dir && dir !== 'memory' ? new PGlite(dir) : new PGlite();
    shared.__zbfDb = drizzlePglite(client, { schema }) as unknown as DB;
  } else {
    shared.__zbfDb = drizzleNeon(neon(url), { schema });
  }
  return shared.__zbfDb;
}
