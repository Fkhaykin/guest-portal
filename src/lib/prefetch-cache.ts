// Generic "warm it before they click" cache.
//
// Client-rendered detail pages fetch on mount, so a navigation always pays the
// full round-trip after the click. This primitive lets a source view (a list
// row, a nav link, an open thread) kick the same load off early and stash the
// promise, so the destination page reads an already-resolved value and paints
// instantly.
//
//   const reservations = createPrefetcher(
//     (id: string) => id,                 // cache key
//     (id: string) => fetchReservation(id) // the actual loader
//   );
//   // source: reservations.prefetch(id) on hover / when the row appears
//   // destination: await reservations.get([id])  — instant on a warm hit
//   // after a mutation: reservations.get([id], { force: true }) to refetch
//
// The TTL is short by design: long enough to bridge hover/open → click, short
// enough that stale data never lingers on the screen.

type Entry<T> = { at: number; promise: Promise<T> };

export function createPrefetcher<Args extends unknown[], T>(
  key: (...args: Args) => string | null | undefined,
  loader: (...args: Args) => Promise<T>,
  ttlMs = 60_000
) {
  const cache = new Map<string, Entry<T>>();
  const fresh = (e: Entry<T> | undefined): e is Entry<T> =>
    !!e && Date.now() - e.at < ttlMs;

  // Start a load and cache its promise, but EVICT the entry if it rejects —
  // otherwise a transient failure (offline hover, 500) would be re-served for
  // the whole TTL, breaking Retry paths. The returned promise still rejects for
  // the caller; the .catch here only cleans the cache (and marks it handled).
  const run = (k: string | null | undefined, args: Args): Promise<T> => {
    const promise = loader(...args);
    if (k) {
      const entry = { at: Date.now(), promise };
      cache.set(k, entry);
      promise.catch(() => {
        if (cache.get(k) === entry) cache.delete(k);
      });
    }
    return promise;
  };

  return {
    // Warm the cache ahead of a likely navigation. Cheap to call repeatedly —
    // a fresh in-flight/resolved entry is reused rather than refetched.
    prefetch(...args: Args): void {
      const k = key(...args);
      if (!k) return;
      if (fresh(cache.get(k))) return;
      run(k, args);
    },
    // Load, serving a warm entry instantly when present. Pass { force: true }
    // after an edit so the fetch bypasses (and refreshes) the cache.
    get(args: Args, opts?: { force?: boolean }): Promise<T> {
      const k = key(...args);
      if (k && !opts?.force) {
        const hit = cache.get(k);
        if (fresh(hit)) return hit.promise;
      }
      return run(k, args);
    },
    // Drop a cached entry (e.g. after a delete, so a stale row can't be served).
    invalidate(...args: Args): void {
      const k = key(...args);
      if (k) cache.delete(k);
    },
  };
}
