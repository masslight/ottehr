// The catalogues the executor resolves actions against. Exam and ROS matching is pure and config-driven,
// so the eval harness runs the same matchers; medications and allergens come from the eRx search.
// Conditions and diagnoses need no catalogue: the server has already confirmed their ICD-10 codes.

import { useMemo } from 'react';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useApiClients } from 'src/hooks/useAppClients';
import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import {
  buildRosCatalogue,
  filterUnsupportedQualifiers,
  findExamLeafMatches,
  findRosMatches,
} from 'utils/lib/easy-chart/matchers';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { matchStaticOptions } from '../executor/static-options';
import { Catalogue, CatalogueMatch, CatalogueQuery, CatalogueResult } from '../executor/types';

const ROS_ENTRIES = buildRosCatalogue(InPersonRosConfig);
const EXAM_LEAVES = buildExamLeafCatalogue(DefaultExamComponentsConfig);

export function useCatalogue(): Catalogue {
  const { oystehr } = useApiClients();

  return useMemo<Catalogue>(
    () => ({
      examFindings: async (query) =>
        findExamLeafMatches(query.display, EXAM_LEAVES, { searchTerms: query.searchTerms }),

      rosFindings: async (query) => findRosMatches(query.display, ROS_ENTRIES, { searchTerms: query.searchTerms }),

      // A product whose name claims a site the visit does not support ("vaginal" for athlete's foot) is
      // dropped, not demoted: a demoted candidate still wins when it is the only one.
      medications: async (query) => {
        const matches = await searchErxByName(
          query,
          (term) => oystehr?.erx.searchMedications({ name: term }),
          'medication'
        );
        if (!Array.isArray(matches)) return matches;
        return filterUnsupportedQualifiers(matches, query.evidence ?? query.display);
      },

      allergies: (query) => searchErxByName(query, (term) => oystehr?.erx.searchAllergens({ name: term }), 'allergen'),

      surgicalHistory: async (query) => matchStaticOptions(query, SURGICAL_HISTORY_OPTIONS),
      hospitalizations: async (query) => matchStaticOptions(query, HospitalizationOptions),
    }),
    [oystehr]
  );
}

/**
 * The eRx name search, merged across the display and its synonyms and ranked by the search's own order.
 * Terms under three characters are not sent: the search rejects them.
 */
async function searchErxByName(
  query: CatalogueQuery,
  search: (term: string) => Promise<{ id?: number; name?: string }[]> | undefined,
  label: string
): Promise<CatalogueResult> {
  const terms = [query.display, ...(query.searchTerms ?? [])]
    .map((term) => term?.trim())
    .filter((term): term is string => !!term && term.length >= 3);
  if (terms.length === 0) return [];

  const byId = new Map<string, CatalogueMatch>();
  for (const term of terms) {
    try {
      const response = await search(term);
      if (!response) return undefined;
      response.forEach((row, index) => {
        const id = String(row.id ?? row.name);
        // The first term (what the provider said) wins a tie; synonyms only widen the net.
        if (!byId.has(id)) byId.set(id, { id, display: row.name ?? term, score: 1 / (index + 1), payload: row });
      });
    } catch (error) {
      console.error(`[easy-chart] ${label} search failed`, error);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}
