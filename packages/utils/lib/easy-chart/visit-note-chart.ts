// The whole chart in one object, from a visit note.
//
// Easy Chart reads the chart as ONE `GetChartDataResponse`: the executor's snapshot, the prompt's chart-state
// summary and the note-field context are all written against that shape. It used to assemble it from two
// get-chart-data reads (the default set, then the fields that endpoint fetched only when named — and a field
// left out of the second read came back as an empty section, which is how hospitalizations went invisible).
// The chart is read through the visit note now: every section plus the vitals, lab results, radiology orders
// and participants in one read, a fixed set that cannot lose a field that way. `visitNoteToLegacyChartData`
// presents a note as the two responses the old reads produced; this folds them into the one object Easy Chart
// reads, on the server (easy-chart-plan, easy-chart-review) and in the browser (useEasyChartData) alike, so the
// assistant and its prompts describe one chart.

import { visitNoteToLegacyChartData } from '../helpers/visit-note/visit-note-to-chart-data.helper';
import { GetChartDataResponse } from '../types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from '../types/api/chart-data/get-visit-note.types';

export function wholeChartFromVisitNote(note: VisitNoteResponse): GetChartDataResponse {
  const { chartData, additionalChartData } = visitNoteToLegacyChartData(note, { module: 'in-person' });
  // The progress-note shape is authoritative for every key it carries a value for. A key it leaves undefined
  // (`procedures`, say) belongs to the whole-chart shape and must not be blanked by the spread.
  const defined = Object.fromEntries(Object.entries(additionalChartData).filter(([, value]) => value !== undefined));
  return { ...chartData, ...defined };
}
