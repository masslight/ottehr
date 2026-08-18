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
//
// ONE ENTRY IS DELIBERATELY NOT A CATALOGUE: `conditions`. The server's ICD guard already confirms
// {code, display} from ONE terminology row, so add-condition charts the validated code directly, the
// same path add-diagnosis takes — a client catalogue here could only disagree with the server.
//
// `procedures` IS a catalogue, and it resolves against the practice's own quick-picks. It was deferred
// while per-ITEM provenance was the only kind: a quick-pick pre-fills ten clinical fields the provider
// never said — complications, patientResponse and timeSpent among them — so one confirm click would
// have accepted ten unspoken assertions, two of them legal claims and one feeding billing. The
// per-FIELD "default, verify" marker now exists, which is what made it safe to wire.

import { useQueryClient } from '@tanstack/react-query';
import { Encounter } from 'fhir/r4b';
import { useCallback, useMemo } from 'react';
import { listTemplates } from 'src/api/api';
import { HospitalizationOptions } from 'src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useApiClients } from 'src/hooks/useAppClients';
import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import {
  filterUnsupportedQualifiers,
  findExamLeafMatches,
  findRosMatches,
  RosCatalogueEntry,
} from 'utils/lib/easy-chart/matchers';
import {
  labOrgIdsFor,
  matchNamedCatalogue,
  matchRadiologyStudy,
  resolveLabPaymentMethod,
  resolveOrderingOffice,
} from 'utils/lib/easy-chart/order-matching';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { radiologyStudiesConfig } from 'utils/lib/ottehr-config/radiology';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { procedureQuickPickContext } from '../executor/procedure-quick-pick';
import {
  Catalogue,
  CatalogueMatch,
  CatalogueQuery,
  CatalogueResult,
  catalogueUnavailable,
  ExternalLabOrderContext,
} from '../executor/types';
import { useProcedureQuickPicks } from './useProcedureQuickPicks';

/**
 * The exam config an encounter was charted under may be older than the current one. Passing the
 * encounter's own config keeps the matcher honest about which leaves exist for THIS visit; the
 * default is the fallback for a page that has not resolved it yet.
 */
export interface UseCatalogueOptions {
  examComponents?: typeof DefaultExamComponentsConfig;
  /** Required for the lab catalogues: both are scoped to the encounter and its ordering office. */
  encounterId?: string;
}

const ROS_ENTRIES: RosCatalogueEntry[] = Object.values(InPersonRosConfig).flatMap((system) =>
  Object.entries(system.items).map(([baseField, item]) => ({
    baseField,
    label: item.label,
    systemLabel: system.label,
  }))
);

/** Not available on this page yet — distinct from "searched and found nothing". */
const UNAVAILABLE = async (): Promise<CatalogueResult> => catalogueUnavailable();

export function useCatalogue(options: UseCatalogueOptions = {}): Catalogue {
  const { oystehr, oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const apiClient = useOystehrAPIClient();
  const examComponents = options.examComponents ?? DefaultExamComponentsConfig;
  const encounterId = options.encounterId;

  const examLeaves = useMemo(() => buildExamLeafCatalogue(examComponents), [examComponents]);

  const loadProcedureQuickPicks = useProcedureQuickPicks();

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

      return matchNamedCatalogue(query.display, query.searchTerms, search.labs ?? [], (lab) => lab.item.itemName).map(
        (scored) => ({
          id: scored.item.item.itemCode ?? scored.item.item.itemName,
          display: scored.item.item.itemName,
          score: scored.score,
          payload: { item: scored.item, encounter, office, paymentMethod } satisfies ExternalLabOrderContext,
        })
      );
    },
    [apiClient, oystehr, encounterId]
  );

  // The practice's saved templates, by title. Cached for the session — the list changes when an admin
  // edits it, not while a provider charts — but AWAITED rather than read off a hook's state, for the same
  // reason the procedure quick-picks are: a dictation can arrive before the list has settled, and an
  // empty list is a meaningful answer ("no template matches that") rather than "not loaded yet".
  const loadTemplates = useCallback(async () => {
    if (!oystehrZambda) return undefined;
    return queryClient.ensureQueryData({
      queryKey: ['easy-chart-templates'],
      queryFn: async () => {
        const response = await listTemplates(oystehrZambda, { includeVersionData: false });
        return response.templates;
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, oystehrZambda]);

  return useMemo<Catalogue>(
    () => ({
      examFindings: async (query: CatalogueQuery) =>
        findExamLeafMatches(query.display, examLeaves, { searchTerms: query.searchTerms }),

      rosFindings: async (query: CatalogueQuery) =>
        findRosMatches(query.display, ROS_ENTRIES, { searchTerms: query.searchTerms }),

      templates: async (query: CatalogueQuery) => {
        const templates = await loadTemplates();
        // `undefined` means the client is not there to ask, which is not the same as "no template
        // matches" — applying the wrong template pollutes the note, so the two must not be conflated.
        if (!templates) return undefined;
        return matchByTitle(
          templates.map((t) => ({ id: t.id, title: t.title })),
          query
        );
      },

      // RIGHT DRUG, RIGHT FORM (requirements section 9). A name search ranks "Clotrimazole AF Athlete's
      // Foot Cream" and "Miconazole Vaginal Cream" interchangeably for "antifungal cream" — same active
      // ingredient, different route and indication. Candidates whose product name claims a site the
      // visit does not support are DROPPED, not demoted: a demoted candidate still wins when it is the
      // only one, which is exactly the case that charts the wrong product.
      medications: async (query: CatalogueQuery) => {
        const matches = await searchErxByName(
          query,
          (term) => oystehr?.erx.searchMedications({ name: term }),
          'medication'
        );
        // An unavailable catalogue is a different fact from a filtered one — pass it straight through.
        if (!Array.isArray(matches)) return matches;
        return filterUnsupportedQualifiers(matches, query.evidence ?? query.display);
      },

      // The sibling of the medication search: same API, same shape, same scoring.
      allergies: (query: CatalogueQuery) =>
        searchErxByName(query, (term) => oystehr?.erx.searchAllergens({ name: term }), 'allergen'),

      // Static lists already in the repository. The dictation contains the WHOLE input — the procedure
      // or condition name — so there is nothing to derive and nothing to guess: only a fuzzy match,
      // exactly like examFindings and rosFindings.
      surgicalHistory: async (query: CatalogueQuery) => matchStaticOptions(query, SURGICAL_HISTORY_OPTIONS),
      hospitalizations: async (query: CatalogueQuery) => matchStaticOptions(query, HospitalizationOptions),

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

      // `add-condition` needs no catalogue at all: the server's ICD guard already confirms its
      // {code, display} against the terminology service from ONE row, exactly as it does for
      // add-diagnosis, so the handler charts the validated code directly. This entry exists only
      // because the Catalogue interface is exhaustive.
      conditions: UNAVAILABLE,

      // The practice's procedure quick-picks. The whole resolved write context goes in `payload` —
      // the DTO, the codes to link, and which fields the template filled — because the writer must not
      // re-derive any of it, and the "default, verify" set is decided HERE, where the template's
      // contribution is still distinguishable from the provider's words.
      procedures: async (query: CatalogueQuery) => {
        const { quickPicks, procedureTypeNameByCode } = await loadProcedureQuickPicks();
        if (quickPicks.length === 0) {
          // Not "searched and found nothing": a practice with no quick-picks configured cannot chart a
          // procedure from a dictation at all, and the provider needs to know which of the two it is.
          return catalogueUnavailable(
            `This practice has no procedure quick-picks configured, so "${query.display}" has to be charted from the Procedures tab.`
          );
        }
        return matchNamedCatalogue(query.display, query.searchTerms, quickPicks, (pick) => pick.name).map((scored) => ({
          id: scored.item.id ?? scored.item.name,
          display: scored.item.name,
          score: scored.score,
          payload: procedureQuickPickContext(scored.item, procedureTypeNameByCode),
        }));
      },
    }),
    [examLeaves, oystehr, loadTemplates, searchInHouseLabs, searchExternalLabs, loadProcedureQuickPicks]
  );
}

/**
 * A named-option list (`{ display, code }`) matched against the dictated name. `payload` carries the
 * whole option, because the write needs its code and not just its label.
 */
function matchStaticOptions(query: CatalogueQuery, options: { display?: string; code?: string }[]): CatalogueMatch[] {
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
 * The eRx name search, shared by medications and allergens.
 *
 * Queries under three characters are NOT sent: the eRx and ICD searches reject them, so filtering here
 * turns a guaranteed failed request into one fewer round trip. If every term is too short the result is
 * an empty list — searched, nothing matched — not "unavailable".
 */
async function searchErxByName(
  query: CatalogueQuery,
  search: (term: string) => Promise<{ id?: number; name?: string }[]> | undefined,
  label: string
): Promise<CatalogueResult> {
  const terms = [query.display, ...(query.searchTerms ?? [])]
    .map((term) => term?.trim())
    .filter((term): term is string => Boolean(term) && term!.length >= 3);
  if (terms.length === 0) return [];

  const byId = new Map<string, CatalogueMatch>();
  for (const term of terms) {
    try {
      const response = await search(term);
      if (!response) return undefined;
      response.forEach((row, index) => {
        const id = String(row.id ?? row.name);
        // First term wins on ties: the display is what the provider actually said, and the synonyms
        // exist to widen the net, not to outrank it.
        if (!byId.has(id)) {
          // Rank by the search's own ordering, decaying down the list.
          byId.set(id, { id, display: row.name ?? term, score: 1 / (index + 1), payload: row });
        }
      });
    } catch (error) {
      console.error(`[easy-chart] ${label} search failed`, error);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
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
