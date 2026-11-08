import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { setDbForTests, type DB } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';

/** Banco Postgres real (PGlite, em memória) com as migrações do projeto aplicadas. */
export async function createTestDb(): Promise<DB> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  const typed = db as unknown as DB;
  setDbForTests(typed);
  return typed;
}
