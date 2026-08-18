// The catalogues the executor resolves against.
//
// The exam and ROS matchers are PURE and config-driven, so they run identically here and in the
// offline eval replay harness — which is the point: exam/ROS mismatches are the failure class a
// replay over committed fixtures is meant to catch, and that cannot need a live environment.
//
// A catalogue that is NOT AVAILABLE here returns `undefined`, which is a different fact from `[]`.
// `[]` means "searched, nothing matched" and tells the provider to reword. `undefined` means "this
// catalogue is not on this page yet" and tells them to use the regular chart. Reporting the second
// as the first would send them looking for the wrong problem — "no allergy matches penicillin"
// implies the allergy database was consulted and came back empty.

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { listTemplates } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import { findExamLeafMatches, findRosMatches, RosCatalogueEntry } from 'utils/lib/easy-chart/matchers';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { Catalogue, CatalogueMatch, CatalogueQuery, CatalogueResult } from '../executor/types';

/**
 * The exam config an encounter was charted under may be older than the current one. Passing the
 * encounter's own config keeps the matcher honest about which leaves exist for THIS visit; the
 * default is the fallback for a page that has not resolved it yet.
 */
export interface UseCatalogueOptions {
  examComponents?: typeof DefaultExamComponentsConfig;
}

const ROS_ENTRIES: RosCatalogueEntry[] = Object.values(InPersonRosConfig).flatMap((system) =>
  Object.entries(system.items).map(([baseField, item]) => ({
    baseField,
    label: item.label,
    systemLabel: system.label,
  }))
);

/** Not available on this page yet — distinct from "searched and found nothing". */
const UNAVAILABLE = async (): Promise<CatalogueResult> => undefined;

export function useCatalogue(options: UseCatalogueOptions = {}): Catalogue {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  const examComponents = options.examComponents ?? DefaultExamComponentsConfig;
  const encounterId = options.encounterId;

  const examLeaves = useMemo(() => buildExamLeafCatalogue(examComponents), [examComponents]);

  /**
   * The practice's in-house test catalogue for this encounter. Two calls place an in-house order and
   * this is the first — the test ITEM goes in `payload`, because the create call needs the item, not
   * just its name.
   */
  const searchInHouseLabs = useCallback(
    async (query: CatalogueQuery): Promise<CatalogueResult> => {
      if (!apiClient || !encounterId) return catalogueUnavailable();
      const resources = await apiClient.getCreateInHouseLabOrderResources({ encounterId });
      return matchNamedCatalogue(query.display, query.searchTerms, resources.labs ?? [], (lab) => lab.name).map(
        (scored) => ({
          id: scored.item.name,
          display: scored.item.name,
          score: scored.score,
          payload: scored.item,
        })
      );
    },
    [apiClient, encounterId]
  );

  /**
   * The send-out catalogue, scoped to the labs the ordering office has enabled. Everything the order
   * needs beyond the test name — office, coverage, payment method, the full Encounter — is resolved
   * here from real data and carried in `payload`; none of it comes from the dictation.
   */
  const searchExternalLabs = useCallback(
    async (query: CatalogueQuery): Promise<CatalogueResult> => {
      if (!apiClient || !oystehr || !encounterId) return catalogueUnavailable();

      const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
      const patientId = encounter.subject?.reference?.replace('Patient/', '');
      const encounterLocationId = encounter.location
        ?.find((entry) => entry.location?.reference?.startsWith('Location/'))
        ?.location?.reference?.replace('Location/', '');

      const resources = await apiClient.getCreateExternalLabResources({ patientId, encounterId });
      const office = resolveOrderingOffice(resources.orderingLocations, encounterLocationId);
      if (!office) {
        return catalogueUnavailable(
          `No lab-enabled ordering office for this visit — place "${query.display}" from the Labs tab.`
        );
      }

      const search = await apiClient.getCreateExternalLabResources({
        search: query.display,
        labOrgIdsString: labOrgIdsFor(office),
      });

      // Derived, not chosen by the model, and the same defaulting the regular Labs tab applies — the
      // provider can change it on the order afterwards.
      const paymentMethod = resolveLabPaymentMethod({
        appointmentIsWorkersComp: resources.appointmentIsWorkersComp,
        coverageCount: resources.coverages?.length ?? 0,
      });

      return matchNamedCatalogue(
        query.display,
        query.searchTerms,
        search.labs ?? [],
        (lab) => lab.item.itemName
      ).map((scored) => ({
        id: scored.item.item.itemCode ?? scored.item.item.itemName,
        display: scored.item.item.itemName,
        score: scored.score,
        payload: { item: scored.item, encounter, office, paymentMethod } satisfies ExternalLabOrderContext,
      }));
    },
    [apiClient, oystehr, encounterId]
  );

  // The practice's saved templates, by title. Cached for the session: the list changes when an admin
  // edits it, not while a provider charts, and every apply-template action would otherwise re-fetch.
  const { data: templates } = useQuery({
    queryKey: ['easy-chart-templates'],
    queryFn: async () => {
      if (!oystehrZambda) return [];
      const response = await listTemplates(oystehrZambda, { includeVersionData: false });
      return response.templates;
    },
    enabled: Boolean(oystehrZambda),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo<Catalogue>(
    () => ({
      examFindings: async (query: CatalogueQuery) =>
        findExamLeafMatches(query.display, examLeaves, { searchTerms: query.searchTerms }),

      rosFindings: async (query: CatalogueQuery) =>
        findRosMatches(query.display, ROS_ENTRIES, { searchTerms: query.searchTerms }),

      templates: async (query: CatalogueQuery) => {
        if (!oystehrZambda) return undefined;
        if (!templates) return [];
        return matchByTitle(templates.map((t) => ({ id: t.id, title: t.title })), query);
      },

      medications: async (query: CatalogueQuery) => {
        if (!oystehr) return undefined;
        const terms = [query.display, ...(query.searchTerms ?? [])].filter((t) => t?.trim());
        const byId = new Map<string, CatalogueMatch>();
        for (const term of terms) {
          try {
            const response = await oystehr.erx.searchMedications({ name: term });
            response.forEach((medication, index) => {
              const id = String(medication.id ?? medication.name);
              // First term wins on ties: the display is what the provider actually said, and the
              // synonyms exist to widen the net, not to outrank it.
              if (!byId.has(id)) {
                byId.set(id, {
                  id,
                  display: medication.name ?? term,
                  // Rank by the search's own ordering, decaying down the list.
                  score: 1 / (index + 1),
                  payload: medication,
                });
              }
            });
          } catch (error) {
            console.error('[easy-chart] medication search failed', error);
          }
        }
        return [...byId.values()].sort((a, b) => b.score - a.score);
      },

      labs: async (query) => (query.inHouse ? searchInHouseLabs(query) : searchExternalLabs(query)),

      radiology: async (query: CatalogueQuery) => {
        const match = matchRadiologyStudy(query.display, query.searchTerms, radiologyStudiesConfig);
        if (match.status === 'wrong-modality') {
          // A wrong study charted with full confidence is the failure this prevents: "venous duplex
          // ultrasound" once resolved to CPT 73590, "X-ray of lower leg", because partial-word
          // matching found the body part. Across modalities, no match is strictly safer.
          return catalogueUnavailable(
            `"${query.display}" is not an X-ray — the in-clinic imaging catalogue covers X-rays only. Order it from the Radiology tab.`
          );
        }
        if (match.status === 'no-match') return [];
        return [{ id: match.code, display: match.study.display ?? query.display, score: 1, payload: match.code }];
      },

      // Not on this page yet. Each needs a structured selection the note pane does not offer yet — an
      // allergy's reaction and criticality, a condition's onset, a procedure's field set — so the step
      // says so and names the regular chart, rather than charting a guess.
      allergies: UNAVAILABLE,
      conditions: UNAVAILABLE,
      surgicalHistory: UNAVAILABLE,
      hospitalizations: UNAVAILABLE,
      procedures: UNAVAILABLE,
    }),
    [examLeaves, oystehr, oystehrZambda, templates, searchInHouseLabs, searchExternalLabs]
  );
}

/**
 * Title matching for catalogues whose rows are named rather than coded. Exact match wins outright;
 * a containment is plausible; token overlap is a weak last resort. Anything with no overlap at all
 * is left out, so a wrong template can never be applied on a thin match — a mismatched template
 * pollutes the note with the wrong exam and MDM scaffolding, and is worse than no template.
 */
function matchByTitle(rows: { id: string; title: string }[], query: CatalogueQuery): CatalogueMatch[] {
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
