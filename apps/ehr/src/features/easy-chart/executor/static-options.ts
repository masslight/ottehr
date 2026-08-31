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
