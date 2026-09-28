// Matching a dictated name against a static coded option list (surgical history, hospitalizations).
// Kept out of useCatalogue so the eval harness can import it without the React app behind it.

import { CatalogueMatch, CatalogueQuery } from './types';

/** Words that describe the request rather than the thing named; each once pulled a match off target. */
const QUERY_STOPWORDS = new Set([
  'order',
  'send',
  'run',
  'a',
  'an',
  'the',
  'out',
  'in',
  'house',
  'office',
  'lab',
  'labs',
  'test',
  'tests',
  'do',
  'get',
  'please',
  'to',
  'and',
  'for',
  'reference',
  'panel',
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Token-overlap score: a whole-token hit outweighs a prefix hit, an exact name wins outright, and a name
 * much longer than the query is penalised so one shared word does not win. The match's id is the
 * option's code.
 */
export function matchStaticOptions(
  query: CatalogueQuery,
  options: { display?: string; code?: string }[]
): CatalogueMatch[] {
  const queryTokens = [
    ...new Set(
      [query.display, ...(query.searchTerms ?? [])]
        .flatMap(tokenize)
        .filter((token) => token.length >= 2 && !QUERY_STOPWORDS.has(token))
    ),
  ];
  if (queryTokens.length === 0) return [];
  const exact = query.display.trim().toLowerCase();

  return options
    .flatMap((option) => {
      const display = option.display ?? '';
      const nameTokens = tokenize(display);
      let score = 0;
      for (const token of queryTokens) {
        if (nameTokens.includes(token)) score += 20;
        else if (nameTokens.some((nameToken) => nameToken.startsWith(token))) score += 5;
      }
      if (display.trim().toLowerCase() === exact) score += 1000;
      score -= Math.max(0, nameTokens.length - queryTokens.length) * 2;
      return score > 0 ? [{ id: option.code ?? display, display, score, payload: option }] : [];
    })
    .sort((a, b) => b.score - a.score);
}
