import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';

/**
 * Adds the columns of `prev` to the rows of `next`, matched by `key`: `next` holds the base and the layers just
 * loaded, `prev` the layers loaded before. Returns null when the two are not the same set of rows (a visit was
 * created or deleted in between, or a key is missing / repeated): the caller then loads everything again.
 */
export function mergeRows(prev: AdHocRow[], next: AdHocRow[], key: string): AdHocRow[] | null {
  if (prev.length !== next.length) return null;

  const prevByKey = new Map<string, AdHocRow>();

  for (const row of prev) {
    const value = row[key];
    if (value === undefined || value === null || value === '' || prevByKey.has(String(value))) return null;
    prevByKey.set(String(value), row);
  }

  const merged: AdHocRow[] = [];

  for (const row of next) {
    const old = prevByKey.get(String(row[key]));
    if (!old) return null;
    merged.push({ ...old, ...row });
  }

  return merged;
}
