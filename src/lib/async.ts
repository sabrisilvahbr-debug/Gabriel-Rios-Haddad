/** Executa `fn` para cada item com no máximo `limit` chamadas ao mesmo tempo, mantendo a ordem. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
