// The headless executor context: the real exam, ROS and static-option matchers, and an echo for the
// eRx-backed catalogues, so the score measures the planner rather than a practice's inventory.

import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import { buildRosCatalogue, findExamLeafMatches, findRosMatches } from 'utils/lib/easy-chart/matchers';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { buildChartSnapshot } from '../../apps/ehr/src/features/easy-chart/executor/chartSnapshot';
import { matchStaticOptions } from '../../apps/ehr/src/features/easy-chart/executor/static-options';
import {
  Catalogue,
  CatalogueQuery,
  CatalogueResult,
  ChartWriter,
  HandlerContext,
} from '../../apps/ehr/src/features/easy-chart/executor/types';
import { HospitalizationOptions } from '../../apps/ehr/src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from '../../apps/ehr/src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';

/** The dictated name is the match. */
const echo = async (query: CatalogueQuery): Promise<CatalogueResult> =>
  query.display.trim() ? [{ id: query.display, display: query.display, score: 1 }] : [];

export function buildEvalContext(): { context: HandlerContext } {
  const examLeaves = buildExamLeafCatalogue(DefaultExamComponentsConfig);
  const rosEntries = buildRosCatalogue(InPersonRosConfig);

  let nextId = 1;
  const writer: ChartWriter = {
    save: async () => [`row-${nextId++}`],
  };

  const catalogue: Catalogue = {
    examFindings: async (query) => findExamLeafMatches(query.display, examLeaves, { searchTerms: query.searchTerms }),
    rosFindings: async (query) => findRosMatches(query.display, rosEntries, { searchTerms: query.searchTerms }),
    medications: echo,
    allergies: echo,
    surgicalHistory: async (query) => matchStaticOptions(query, SURGICAL_HISTORY_OPTIONS),
    hospitalizations: async (query) => matchStaticOptions(query, HospitalizationOptions),
  };

  const context: HandlerContext = {
    mode: 'bulk',
    catalogue,
    writer,
    chart: buildChartSnapshot(undefined),
    ask: async () => {
      throw new Error('the eval harness must never be asked to disambiguate: bulk mode auto-picks');
    },
    say: () => undefined,
  };

  return { context };
}
