// `saveChartData` returns the rows it saved, new and updated alike, so the new ones are those whose
// `resourceId` the cached chart did not already hold.

/**
 * Every `resourceId` reachable in a chart-data payload, at any depth. Walks generically so new sections are
 * covered without a per-section list.
 */
export function collectResourceIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectResourceIds(item, into);
    return into;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'resourceId' && typeof child === 'string' && child) into.add(child);
      else collectResourceIds(child, into);
    }
  }
  return into;
}

export function diffCreatedResourceIds(before: Set<string>, after: Iterable<string>): string[] {
  const created: string[] = [];
  for (const id of after) {
    if (!before.has(id)) created.push(id);
  }
  return created;
}
