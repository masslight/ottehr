// "What did I just create?" — the before/after diff that turns a whole-chart save response into a
// list of the rows it added.
//
// `saveChartData` returns the WHOLE updated chart, not a description of what it added. Anything that
// needs the id of a row it just created — to highlight it as AI-written, attach its source quote, or
// make it click-to-correct — has to compare before against after.
//
// This lives beside the shared save hook rather than inside a feature, so every future caller that
// needs it gets it. It is deliberately generic: chart DTOs all carry `resourceId`, so walking the
// response for that key covers every section without a per-section list to keep in sync.

/**
 * Every `resourceId` reachable in a chart-data payload, at any depth.
 *
 * Generic on purpose. A hand-written list of sections to walk is a list that goes stale the first
 * time someone adds a section — and the symptom would be an AI-written row that silently renders as
 * provider-entered.
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

/** The ids present in `after` that were not present in `before`. */
export function diffCreatedResourceIds(before: Set<string>, after: Iterable<string>): string[] {
  const created: string[] = [];
  for (const id of after) {
    if (!before.has(id)) created.push(id);
  }
  return created;
}
