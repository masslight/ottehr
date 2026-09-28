/**
 * Resolve the title the model put on an apply-template to one of the practice's templates. The model is
 * told to use exact titles; this tolerates case, punctuation and a dropped word, not guessing: exact
 * match, then containment, then the title sharing at least half of its words with the query.
 */
export function resolveSuggestedTemplate<T extends { id: string; title: string }>(
  templates: readonly T[],
  action: { display?: string; searchTerms?: string[] }
): T | undefined {
  const norm = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  // Spaces dropped for the exact and containing checks, so "X-Ray" and "xray" are the same title.
  const compact = (text: string): string => norm(text).replace(/ /g, '');
  const query = norm(action.display ?? '');
  if (!query) return undefined;
  const queryCompact = compact(query);

  const exact = templates.find((template) => compact(template.title) === queryCompact);
  if (exact) return exact;

  const containing = templates.filter((template) => {
    const title = compact(template.title);
    return title.includes(queryCompact) || queryCompact.includes(title);
  });
  if (containing.length > 0) return containing.sort((a, b) => a.title.length - b.title.length)[0];

  const queryWords = new Set(
    [query, ...(action.searchTerms ?? []).map(norm)].flatMap((text) => text.split(' ')).filter(Boolean)
  );
  let best: { template: T; score: number } | undefined;
  for (const template of templates) {
    const titleWords = norm(template.title).split(' ').filter(Boolean);
    if (titleWords.length === 0) continue;
    const shared = titleWords.filter((word) => queryWords.has(word)).length;
    const score = shared / titleWords.length;
    if (score >= 0.5 && (!best || score > best.score)) best = { template, score };
  }
  return best?.template;
}
