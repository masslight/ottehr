import { AdHocRow } from 'utils/lib/types/adhoc/datasets/llm-schema';

export function layersToLoad(loaded: ReadonlySet<string>, wanted: readonly string[]): string[] {
  const missing = wanted.filter((id) => !loaded.has(id));
  const sources = new Set(missing.filter((id) => id.includes('.')).map((id) => id.slice(0, id.indexOf('.'))));
  return wanted.filter((id) => missing.includes(id) || sources.has(id.slice(0, id.indexOf('.'))));
}

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
    const value = String(row[key]);
    const old = prevByKey.get(value);

    if (!old) return null;

    prevByKey.delete(value);
    merged.push({ ...old, ...row });
  }

  return merged;
}
