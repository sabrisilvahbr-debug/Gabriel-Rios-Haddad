import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../helpers/db';
import type { DB } from '@/lib/db/client';
import { businesses } from '@/lib/db/schema';
import { getAppState, getSettings, updateSettings } from '@/lib/db/settings';

let db: DB;

beforeEach(async () => {
  db = await createTestDb();
});

describe('settings', () => {
  it('settings defaults', async () => {
    const s = await getSettings();
    expect(s.dailyLimit).toBe(20);
    expect(s.windowStartHour).toBe(9);
    expect(s.windowEndHour).toBe(18);
    expect(s.windowDays).toBe('1,2,3,4,5,6');
    expect(s.minIntervalMin).toBe(4);
    expect(s.maxIntervalMin).toBe(12);
    expect(s.messageTemplates).toHaveLength(3);
    expect(s.outreachEnabled).toBe(false);
    expect(s.aiRepliesEnabled).toBe(false);
    expect(s.aiMaxReplies).toBe(8);
  });

  it('updates only the given fields', async () => {
    await updateSettings({ agencyName: 'Agência Sol', dailyLimit: 10 });
    const s = await getSettings();
    expect(s.agencyName).toBe('Agência Sol');
    expect(s.dailyLimit).toBe(10);
    expect(s.windowEndHour).toBe(18);
  });

  it('creates the app state row on first read', async () => {
    const state = await getAppState();
    expect(state.sentCount).toBe(0);
    expect(state.waConnectionState).toBe('unknown');
  });
});

describe('businesses', () => {
  it('unique place_id', async () => {
    const row = {
      placeId: 'ChIJ123',
      name: 'Barbearia do Zé',
      phoneDisplay: '(19) 98765-4321',
      phoneE164: '+5519987654321',
      phoneIsMobile: true,
    };
    await db.insert(businesses).values(row).onConflictDoNothing();
    await db.insert(businesses).values(row).onConflictDoNothing();
    const all = await db.select().from(businesses);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('nova');
  });
});
