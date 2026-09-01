// Matching a dictated name against a static, coded option list.
//
// Two catalogues work this way — surgical history (31 CPT-coded operations) and hospitalizations (29
// SNOMED-coded admission reasons). Both are compiled into the app and identical for every practice, so
// there is nothing to fetch and nothing to guess: the dictation contains the whole input, and all that
// is left is a fuzzy match, exactly as for exam findings and ROS.
//
// IT LIVES HERE, next to the executor, and NOT in useCatalogue where it was written. The eval harness
// resolves these two catalogues too, and it deliberately imports only leaf modules from the app —
// pulling in a React hook drags the api client, react-query and the app's whole dependency graph behind
// it, and the harness will not load. Keeping the function where both callers can reach it is what stops
// the harness growing a copy that quietly drifts from what ships.

import { matchNamedCatalogue } from 'utils/lib/easy-chart/order-matching';
import { CatalogueMatch, CatalogueQuery } from './types';

/**
 * `payload` carries the WHOLE option, not just the label, because the write needs its code:
 * `add-surgical-history` charts `{ display: match.display, ...match.payload }`. A matcher that returned
 * only a display would put a bare label on the chart where a coded row belongs — which is precisely what
 * the harness's stub did before it used this.
 */
export function matchStaticOptions(
  query: CatalogueQuery,
  options: { display?: string; code?: string }[]
): CatalogueMatch[] {
  return matchNamedCatalogue(query.display, query.searchTerms, options, (option) => option.display ?? '').map(
    (scored) => ({
      id: scored.item.code ?? scored.item.display ?? '',
      display: scored.item.display ?? '',
      score: scored.score,
      payload: scored.item,
    })
  );
}

/**
 * Title matching for catalogues whose rows are NAMED rather than coded — templates are the only one. Exact match wins outright;
 * a containment is plausible; token overlap is a weak last resort. Anything with no overlap at all
 * is left out, so a wrong template can never be applied on a thin match — a mismatched template
 * pollutes the note with the wrong exam and MDM scaffolding, and is worse than no template.
 *
 * Here for the same reason as matchStaticOptions: the eval harness resolves templates too, and it
 * stubbed them to accept ANY title as a match — so a title the model invented resolved as though the
 * practice had it. Sharing this function is what makes the harness refuse an invented name the way
 * production does.
 */
export function matchByTitle(rows: { id: string; title: string }[], query: CatalogueQuery): CatalogueMatch[] {
  const terms = [query.display, ...(query.searchTerms ?? [])].map((t) => t?.toLowerCase().trim()).filter(Boolean);
  const matches: CatalogueMatch[] = [];

  for (const row of rows) {
    const title = row.title.toLowerCase();
    const titleTokens = new Set(title.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
    let best = 0;

    for (const term of terms as string[]) {
      if (title === term) {
        best = 1;
        break;
      }
      if (title.includes(term) || term.includes(title)) {
        best = Math.max(best, 0.8);
        continue;
      }
      const termTokens = (term.split(/[^a-z0-9]+/) ?? []).filter((t) => t.length > 2);
      if (termTokens.length === 0) continue;
      const hits = termTokens.filter((t) => titleTokens.has(t)).length;
      // Require BOTH sides to be mostly covered. "Ankle Sprain" must not match a "Sprain/strain with
      // xray" template on the single word "sprain" — a fracture that got an x-ray is not a sprain.
      if (hits === 0) continue;
      best = Math.max(best, Math.min(hits / termTokens.length, hits / titleTokens.size) * 0.7);
    }

    if (best > 0) matches.push({ id: row.id, display: row.title, score: best });
  }

  return matches.sort((a, b) => b.score - a.score);
}
