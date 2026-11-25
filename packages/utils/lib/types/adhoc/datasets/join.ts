import { AdHocDatasetLink, linkMatchedColumn } from './links';

type Row = Record<string, unknown>;

const keyOf = (row: Row, field: string): string | undefined => {
  const value = row[field];
  return value === undefined || value === null || value === '' ? undefined : String(value);
};

export function joinRows<T extends Row>(params: {
  host: T[];
  source: Row[];
  link: AdHocDatasetLink;
  columns: ReadonlyArray<{ field: string; column: string }>;
  sourceRowKey: string;
}): { rows: Array<T & Row>; duplicateKeys: number } {
  const { host, source, link, columns, sourceRowKey } = params;
  const matched = linkMatchedColumn(link);

  const byKey = new Map<string, Row>();
  let duplicateKeys = 0;
  for (const row of source) {
    const key = keyOf(row, link.sourceKey);
    if (key === undefined) continue;
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, row);
      continue;
    }
    duplicateKeys++;
    if (String(row[sourceRowKey] ?? '') < String(kept[sourceRowKey] ?? '')) byKey.set(key, row);
  }

  const rows = host.map((row) => {
    const key = keyOf(row, link.key);
    const found = key === undefined ? undefined : byKey.get(key);
    const added: Row = { [matched]: found !== undefined };
    for (const { field, column } of columns) added[column] = found ? found[field] ?? null : null;
    return { ...row, ...added };
  });

  return { rows, duplicateKeys };
}
