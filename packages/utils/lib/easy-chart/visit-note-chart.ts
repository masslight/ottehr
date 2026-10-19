// Folds a visit note into the single GetChartDataResponse Easy Chart reads, on the server and in the browser
// alike, so the assistant and its prompts describe one chart.

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
