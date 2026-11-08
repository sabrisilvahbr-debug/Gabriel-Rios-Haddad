import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/lib/async';

describe('mapWithConcurrency', () => {
  it('keeps the order of results and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5 * (8 - n)));
      running--;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBe(3);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 3, async (n) => n)).toEqual([]);
  });
});
