// The headless executor context: real matchers where they are pure, fakes where the outside world is.
//
// The exam and ROS catalogues are the REAL ones — they are pure functions over a static config, so the
// eval exercises the matcher that ships. Everything that would reach a network (eRx search, the labs
// and imaging catalogues) is a fake that resolves the dictated name to itself: this loop measures what
// the PLANNER produced, and a live catalogue would make the score depend on a practice's inventory
// rather than on the model. What cannot be resolved locally is recorded as such by the executor, and
// the scorer sees it as not charted — which is the honest reading.

import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import { findExamLeafMatches, findRosMatches, RosCatalogueEntry } from 'utils/lib/easy-chart/matchers';
import { matchNamedCatalogue } from 'utils/lib/easy-chart/order-matching';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { buildChartSnapshot } from '../../apps/ehr/src/features/easy-chart/executor/chartSnapshot';
import { procedureQuickPickContext } from '../../apps/ehr/src/features/easy-chart/executor/procedure-quick-pick';
import { matchByTitle, matchStaticOptions } from '../../apps/ehr/src/features/easy-chart/executor/static-options';
import {
  CatalogueMatch,
  CatalogueQuery,
  CatalogueResult,
  catalogueUnavailable,
} from '../../apps/ehr/src/features/easy-chart/executor/types';
import { Catalogue, ChartWriter, HandlerContext } from '../../apps/ehr/src/features/easy-chart/executor/types';
import { HospitalizationOptions } from '../../apps/ehr/src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from '../../apps/ehr/src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { resolveTemplateByDisplay, templateTitles } from './template-catalog';

/** Resolve a query to itself: the dictated name IS the match. Used where a real catalogue would put a
 * practice's inventory between the model and the score. */
const echo = async (query: CatalogueQuery): Promise<CatalogueResult> =>
  query.display.trim() ? [{ id: query.display, display: query.display, score: 1 }] : [];

/**
 * What the fake writer recorded while a plan ran.
 *
 * The sim state is folded from plan STEPS, and a step cannot say what a composite write charted on its
 * behalf: `add-procedure` hands the writer a quick-pick context carrying the procedure's linked
 * diagnoses and CPT codes, and in production `addProcedure` saves all three. The step reports ids, not
 * kinds — so without this log the codes a procedure charted were invisible, and the `cpt` section was
 * scored against a chart that could never contain them.
 */
export interface EvalWriterLog {
  procedures: {
    display: string;
    diagnoses: { code?: string; display?: string }[];
    cptCodes: { code?: string; display?: string }[];
  }[];
}

export interface EvalContextOptions {
  /**
   * The practice's procedure quick-picks, fetched once by the runner.
   *
   * Absent means the catalogue reports itself UNAVAILABLE rather than empty — the same distinction the
   * app draws, and the reason a missing fetch cannot masquerade as "the practice has no quick-picks".
   */
  quickPicks?: ProcedureQuickPickData[];
}

export function buildEvalContext(options: EvalContextOptions = {}): {
  context: HandlerContext;
  writer: ChartWriter;
  writerLog: EvalWriterLog;
} {
  const writerLog: EvalWriterLog = { procedures: [] };
  const examLeaves = buildExamLeafCatalogue(DefaultExamComponentsConfig);
  // Built exactly as the client builds it (see useCatalogue's ROS_ENTRIES). An earlier version of this
  // harness read a `components` field that does not exist and passed the wrong entry shape, so EVERY ros
  // action failed to match and the corpus scored 0/14 on ROS — a harness defect that read as a model
  // failure. If this ever scores a flat zero again, suspect this first.
  const rosEntries: RosCatalogueEntry[] = Object.values(InPersonRosConfig).flatMap((system) =>
    Object.entries(system.items).map(([baseField, item]) => ({
      baseField,
      label: item.label,
      systemLabel: system.label,
    }))
  );

  let nextId = 1;
  const writer: ChartWriter = {
    save: async () => [`row-${nextId++}`],
    remove: async () => undefined,
    // Everything reachable: this loop scores what the planner produced, and an unsupported path here
    // would silently suppress whole categories of action.
    supports: { labOrders: true, radiologyOrders: true, nursingOrders: true, templates: true, procedures: true },
    orderLab: async () => [`row-${nextId++}`],
    orderRadiology: async () => [`row-${nextId++}`],
    createNursingOrder: async () => [`row-${nextId++}`],
    applyTemplate: async () => [`row-${nextId++}`],
    // Records what the quick-pick brought with it. In the app this write also saves the linked
    // diagnoses and CPT codes; the sim learns about them here and nowhere else.
    addProcedure: async (context) => {
      const procedureResourceId = `row-${nextId++}`;
      const linked = [...(context.diagnoses ?? []), ...(context.cptCodes ?? [])].map(() => `row-${nextId++}`);
      writerLog.procedures.push({
        display: context.dto?.procedureType ?? '',
        diagnoses: context.diagnoses ?? [],
        cptCodes: context.cptCodes ?? [],
      });
      return {
        createdResourceIds: [procedureResourceId, ...linked],
        procedureResourceId,
        inferredResourceIds: linked,
        templateFilledFields: context.templateFilledFields ?? [],
      };
    },
  };

  const catalogue: Catalogue = {
    examFindings: async (query) => findExamLeafMatches(query.display, examLeaves, { searchTerms: query.searchTerms }),
    rosFindings: async (query) => findRosMatches(query.display, rosEntries, { searchTerms: query.searchTerms }),
    medications: echo,
    allergies: echo,
    conditions: echo,
    // REAL, not stubbed. Both are static lists compiled into the app — 31 CPT-coded operations and 29
    // SNOMED-coded admission reasons — identical for every practice, so there is no per-customer
    // inventory to keep out of the score and nothing was bought by stubbing them. What it COST was the
    // code: these handlers chart `{ display: match.display, ...match.payload }`, and `echo` carries no
    // payload, so the row went in as a bare label while the gold note holds a code. Resolved through the
    // app's own matchStaticOptions so this cannot drift from what ships.
    surgicalHistory: async (query) => matchStaticOptions(query, SURGICAL_HISTORY_OPTIONS),
    hospitalizations: async (query) => matchStaticOptions(query, HospitalizationOptions),
    // REAL titles from the seed, not an echo. The stub accepted ANY title as a match, so a template name
    // the model invented resolved as though the practice had it — and `templateTitleUnmatched` in the sim
    // could never count anything. `payload` carries the entry so the sim can chart its diagnoses.
    // REAL quick-picks, so `add-procedure` resolves to a context carrying its `dto`, its linked
    // diagnoses and its CPT codes. The stub returned a match with NO payload, which the handler then
    // dereferenced — a TypeError that read as a model failure, and which also meant the CPT codes a
    // procedure charts in production could never appear in the score.
    procedures: async (query) => {
      if (!options.quickPicks) {
        return catalogueUnavailable('procedure quick-picks were not fetched for this run');
      }
      return matchNamedCatalogue(query.display, query.searchTerms, options.quickPicks, (pick) => pick.name).map(
        (scored) => ({
          id: scored.item.id ?? scored.item.name,
          display: scored.item.name,
          score: scored.score,
          // No procedureType NAME map here: it comes from a FHIR ValueSet the harness does not read, so
          // the code stands in for the name. The handler's own fallback covers the display.
          payload: procedureQuickPickContext(scored.item, new Map()),
        })
      );
    },

    templates: async (query) => {
      const matches = matchByTitle(templateTitles(), query);
      return matches.map((match) => ({ ...match, payload: resolveTemplateByDisplay(match.display) }));
    },
    labs: echo,
    radiology: echo,
  };

  const context: HandlerContext = {
    mode: 'bulk',
    encounterId: 'eval',
    catalogue,
    writer,
    chart: buildChartSnapshot(undefined),
    // Bulk mode should never ask; if it does, that is a defect worth failing loudly on rather than
    // hanging a batch run.
    ask: async () => {
      throw new Error('the eval harness must never be asked to disambiguate: bulk mode auto-picks');
    },
    say: () => undefined,
  };

  return { context, writer, writerLog };
}

export type { CatalogueMatch };
