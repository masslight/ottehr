// The chart as the executor sees it: `{ resourceId, display }` rows, where `display` is the text a
// provider recognises, because removals and duplicate checks match the model's wording against it.

import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import { NOTE_TEXT_FIELDS, NoteTextField } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { chartKeyForNoteField } from 'utils/lib/easy-chart/note-fields';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { getRosFindingStateFromKey } from 'utils/lib/ottehr-config/review-of-systems';
import { InPersonRosConfig } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ChartedItem, ChartSnapshot } from './types';

const withId = <T extends { resourceId?: string }>(items: T[] | undefined): (T & { resourceId: string })[] =>
  (items ?? []).filter((item): item is T & { resourceId: string } => Boolean(item.resourceId));

const named = <T extends { resourceId?: string }>(items: T[] | undefined, label: (item: T) => string): ChartedItem[] =>
  withId(items)
    .map((item) => ({ resourceId: item.resourceId, display: label(item) }))
    .filter((item) => item.display.trim().length > 0);

export function buildChartSnapshot(chartData: GetChartDataResponse | undefined): ChartSnapshot {
  // A field from an older exam layout keeps its raw name as a label: a row the executor cannot see is
  // a row it would chart a second time.
  const examLabels = new Map(
    buildExamLeafCatalogue(DefaultExamComponentsConfig).map((leaf) => [leaf.field, leaf.label])
  );
  const rosLabels = new Map(
    Object.values(InPersonRosConfig).flatMap((system) =>
      Object.entries(system.items).map(([baseField, item]) => [baseField, `${system.label}: ${item.label}`])
    )
  );

  const checked = (observations: ExamObservationDTO[] | undefined): ExamObservationDTO[] =>
    (observations ?? []).filter((observation) => observation.value === true);

  return {
    diagnoses: withId(chartData?.diagnosis).map((dx) => ({
      resourceId: dx.resourceId,
      display: dx.display,
      code: dx.code,
      isPrimary: dx.isPrimary,
    })),

    examFindings: named(checked(chartData?.examObservations), (o) => o.label ?? examLabels.get(o.field) ?? o.field),

    // Exam observations carrying a card's free-text `note` rather than a tick.
    examComments: (chartData?.examObservations ?? [])
      .filter((o) => typeof o.note === 'string' && o.note.trim().length > 0)
      .map((o) => ({ resourceId: o.resourceId, field: o.field, note: (o.note ?? '').trim() })),

    rosFindings: named(checked(chartData?.rosObservations), (o) => {
      // The key carries the polarity as a suffix; the provider reads "Denies fever".
      const state = getRosFindingStateFromKey(o.field);
      const base = state ? o.field.slice(0, -(state.length + 1)) : o.field;
      const label = rosLabels.get(base) ?? o.label ?? base;
      return state ? `${state === 'denies' ? 'Denies' : 'Reports'} ${label}` : label;
    }),

    medications: named(chartData?.medications, (m) => m.name),
    allergies: named(chartData?.allergies, (a) => a.name ?? ''),
    conditions: named(chartData?.conditions, (c) => c.display ?? c.code ?? ''),
    surgicalHistory: named(chartData?.surgicalHistory, (s) => s.display),
    hospitalizations: named(chartData?.episodeOfCare, (h) => h.display),

    // By storage key, the key a note write uses.
    noteFields: Object.fromEntries(
      NOTE_TEXT_FIELDS.map(chartKeyForNoteField)
        .filter((key) => chartData?.[key])
        .map((key) => [key, chartData?.[key]])
    ),
  };
}

/**
 * The snapshot after one applied action, so later steps of the same plan see it: a swap's removal frees
 * the primary for its add, and a duplicate check sees what was just charted. Kinds no later step reads
 * are no-ops.
 */
export function advanceSnapshot(snapshot: ChartSnapshot, action: PlannedAction, createdIds: string[]): ChartSnapshot {
  const next: ChartSnapshot = {
    ...snapshot,
    diagnoses: [...snapshot.diagnoses],
    examFindings: [...snapshot.examFindings],
    rosFindings: [...snapshot.rosFindings],
    medications: [...snapshot.medications],
    allergies: [...snapshot.allergies],
    conditions: [...snapshot.conditions],
    surgicalHistory: [...snapshot.surgicalHistory],
    hospitalizations: [...snapshot.hospitalizations],
  };
  // A synthetic key when the writer reported no id, so list identity stays stable.
  const id = createdIds[0] ?? `pending:${action.kind}:${action.display ?? action.code ?? ''}`;
  const display = (action.display ?? '').trim();

  const dropByDisplay = (items: ChartedItem[]): ChartedItem[] => {
    const needle = display.toLowerCase();
    if (!needle) return items;
    // The same containment rule the remove handler resolves with.
    const hit =
      items.find((item) => item.display.toLowerCase() === needle) ??
      items.find((item) => item.display.toLowerCase().includes(needle) || needle.includes(item.display.toLowerCase()));
    return hit ? items.filter((item) => item !== hit) : items;
  };

  switch (action.kind) {
    case 'add-diagnosis':
      next.diagnoses.push({ resourceId: id, display, code: action.code, isPrimary: action.isPrimary === true });
      break;
    case 'remove-diagnosis':
      next.diagnoses = dropByDisplay(next.diagnoses) as ChartSnapshot['diagnoses'];
      break;
    case 'add-condition':
      next.conditions.push({ resourceId: id, display });
      break;
    case 'add-allergy':
      next.allergies.push({ resourceId: id, display });
      break;
    case 'add-medication':
      next.medications.push({ resourceId: id, display });
      break;
    case 'remove-medication':
      next.medications = dropByDisplay(next.medications);
      break;
    case 'add-surgical-history':
      next.surgicalHistory.push({ resourceId: id, display });
      break;
    case 'add-hospitalization':
      next.hospitalizations.push({ resourceId: id, display });
      break;
    case 'add-exam-finding':
      next.examFindings.push({ resourceId: id, display });
      break;
    case 'add-ros-finding':
      next.rosFindings.push({ resourceId: id, display });
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
