import { describe, expect, it } from 'vitest';
import { saoPauloParts } from '@/lib/time';

describe('saoPauloParts', () => {
  it('uses the Brasília date, not UTC', () => {
    // 02:30 UTC de terça = 23:30 de segunda em Brasília
    expect(saoPauloParts(new Date('2026-11-10T02:30:00Z'))).toEqual({
      day: '2026-11-09',
      weekday: 1,
      hour: 23,
      minute: 30,
    });
  });

  it('reports Sunday as weekday 0', () => {
    expect(saoPauloParts(new Date('2026-11-08T15:00:00Z')).weekday).toBe(0);
  });
});
