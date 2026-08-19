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
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { buildChartSnapshot } from '../../apps/ehr/src/features/easy-chart/executor/chartSnapshot';
import { CatalogueMatch, CatalogueQuery, CatalogueResult } from '../../apps/ehr/src/features/easy-chart/executor/types';
import { Catalogue, ChartWriter, HandlerContext } from '../../apps/ehr/src/features/easy-chart/executor/types';

/** Resolve a query to itself: the dictated name IS the match. Used where a real catalogue would put a
 * practice's inventory between the model and the score. */
const echo = async (query: CatalogueQuery): Promise<CatalogueResult> =>
  query.display.trim() ? [{ id: query.display, display: query.display, score: 1 }] : [];

export function buildEvalContext(): { context: HandlerContext; writer: ChartWriter } {
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
    addProcedure: async () => ({ createdResourceIds: [`row-${nextId++}`], inferredResourceIds: [] }),
  };

  const catalogue: Catalogue = {
    examFindings: async (query) => findExamLeafMatches(query.display, examLeaves, { searchTerms: query.searchTerms }),
    rosFindings: async (query) => findRosMatches(query.display, rosEntries, { searchTerms: query.searchTerms }),
    medications: echo,
    allergies: echo,
    conditions: echo,
    surgicalHistory: echo,
    hospitalizations: echo,
    templates: echo,
    procedures: echo,
    labs: echo,
    radiology: echo,
  };

  const context: HandlerContext = {
    mode: 'bulk',
    encounterId: 'eval',
    catalogue,
    writer,
    chart: buildChartSnapshot(null),
    // Bulk mode should never ask; if it does, that is a defect worth failing loudly on rather than
    // hanging a batch run.
    ask: async () => {
      throw new Error('the eval harness must never be asked to disambiguate: bulk mode auto-picks');
    },
    say: () => undefined,
  };

  return { context, writer };
}

export type { CatalogueMatch };
