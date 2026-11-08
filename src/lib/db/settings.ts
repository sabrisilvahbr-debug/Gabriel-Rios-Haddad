import { eq } from 'drizzle-orm';
import { DEFAULT_FIRST_TEMPLATES, DEFAULT_FOLLOW_UP } from '@/lib/whatsapp/templates';
import { getDb } from './client';
import { appState, settings, type AppState, type NewAppState, type NewSettings, type Settings } from './schema';

export type SettingsPatch = Partial<Omit<NewSettings, 'id' | 'updatedAt'>>;
export type AppStatePatch = Partial<Omit<NewAppState, 'id' | 'updatedAt'>>;

export async function getSettings(): Promise<Settings> {
  const db = getDb();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (row) return row;
  await db
    .insert(settings)
    .values({ id: 1, messageTemplates: DEFAULT_FIRST_TEMPLATES, followUpTemplate: DEFAULT_FOLLOW_UP })
    .onConflictDoNothing();
  const [created] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return created;
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  await getSettings();
  const [row] = await getDb()
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  return row;
}

export async function getAppState(): Promise<AppState> {
  const db = getDb();
  const [row] = await db.select().from(appState).where(eq(appState.id, 1)).limit(1);
  if (row) return row;
  await db.insert(appState).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select().from(appState).where(eq(appState.id, 1)).limit(1);
  return created;
}

export async function updateAppState(patch: AppStatePatch): Promise<AppState> {
  await getAppState();
  const [row] = await getDb()
    .update(appState)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(appState.id, 1))
    .returning();
  return row;
}
