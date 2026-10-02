// The chart as the executor sees it: what its duplicate checks and in-place updates need.

import { NOTE_TEXT_FIELDS, NoteTextField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { chartKeyForNoteField } from 'utils/lib/easy-chart/note-fields';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ChartSnapshot } from './types';

const withId = <T extends { resourceId?: string }>(items: T[] | undefined): (T & { resourceId: string })[] =>
  (items ?? []).filter((item): item is T & { resourceId: string } => Boolean(item.resourceId));

export function buildChartSnapshot(chartData: GetChartDataResponse | undefined): ChartSnapshot {
  return {
    diagnoses: withId(chartData?.diagnosis).map((dx) => ({
      resourceId: dx.resourceId,
      display: dx.display,
      code: dx.code,
      isPrimary: dx.isPrimary,
    })),
    conditions: withId(chartData?.conditions)
      .map((condition) => ({ resourceId: condition.resourceId, display: condition.display ?? condition.code ?? '' }))
      .filter((condition) => condition.display.trim().length > 0),
    examRows: Object.fromEntries((chartData?.examObservations ?? []).map((row) => [row.field, row])),
    emCode: chartData?.emCode,
    // By storage key, the key a note write uses.
    noteFields: Object.fromEntries(
      NOTE_TEXT_FIELDS.map(chartKeyForNoteField)
        .filter((key) => chartData?.[key])
        .map((key) => [key, chartData?.[key]])
    ),
  };
}

/**
 * The snapshot after one applied action, so later steps of the same plan see it: a second diagnosis sees
 * the first one's primary, and a duplicate check sees what was just charted. `saved` is what the step
 * wrote; exam rows and the E&M row advance from it, so the next write updates them in place.
 */
export function advanceSnapshot(
  snapshot: ChartSnapshot,
  action: PlannedAction,
  createdIds: string[],
  saved: AllChartValues[] = []
): ChartSnapshot {
  const next: ChartSnapshot = {
    ...snapshot,
    diagnoses: [...snapshot.diagnoses],
    conditions: [...snapshot.conditions],
    examRows: { ...snapshot.examRows },
  };
  // A synthetic key when the writer reported no id, so list identity stays stable.
  const id = createdIds[0] ?? `pending:${action.kind}:${action.display ?? action.code ?? ''}`;
  const display = (action.display ?? '').trim();

  // A row saved without an id was created by this step.
  const withCreatedId = <T extends { resourceId?: string }>(row: T): T => {
    const resourceId = row.resourceId ?? createdIds[0];
    return resourceId ? { ...row, resourceId } : row;
  };
  for (const fields of saved) {
    for (const row of fields.examObservations ?? []) next.examRows[row.field] = withCreatedId(row);
    if (fields.emCode) next.emCode = withCreatedId(fields.emCode);
  }

  switch (action.kind) {
    case 'add-diagnosis':
      next.diagnoses.push({ resourceId: id, display, code: action.code, isPrimary: action.isPrimary === true });
      break;
    case 'add-condition':
      next.conditions.push({ resourceId: id, display });
      break;
    case 'edit-note-text': {
      // A second write to the same field in one plan must update the row the first one created.
      const key = chartKeyForNoteField(action.field as NoteTextField);
      const resourceId = createdIds[0] ?? snapshot.noteFields[key]?.resourceId;
      next.noteFields = {
        ...snapshot.noteFields,
        [key]: { ...(resourceId ? { resourceId } : {}), text: action.newText },
      };
      break;
    }
    default:
      break;
  }
  return next;
}
