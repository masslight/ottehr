// Memoized fetches for one report: a search that several layers read runs once; an id is loaded once.
import { FhirResource } from 'fhir/r4b';

/** Runs `fn` once, on the first call; later calls get the same promise. */
export const once = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let promise: Promise<T> | undefined;
  return () => (promise ??= fn());
};

/** A memoized by-id loader: an id is requested once per report, whoever asks; resources land in `map`. */
export interface ByIdLoader<T extends FhirResource> {
  map: Map<string, T>;
  load(ids: (string | undefined)[]): Promise<void>;
  add(resources: T[], opts?: { overwrite?: boolean }): void;
}

export function byIdLoader<T extends FhirResource>(fetch: (ids: string[]) => Promise<T[]>): ByIdLoader<T> {
  const map = new Map<string, T>();
  const pending = new Map<string, Promise<void>>();

  const add = (resources: T[], opts: { overwrite?: boolean } = {}): void => {
    for (const r of resources) if (r.id && (opts.overwrite || !map.has(r.id))) map.set(r.id, r);
  };

  return {
    map,
    add,
    load: async (ids) => {
      const wanted = Array.from(new Set(ids.filter((id): id is string => !!id)));
      const fresh = wanted.filter((id) => !map.has(id) && !pending.has(id));

      if (fresh.length) {
        const request = fetch(fresh).then((resources) => add(resources));
        for (const id of fresh) pending.set(id, request);
      }

      await Promise.all(wanted.map((id) => pending.get(id)));
    },
  };
}
