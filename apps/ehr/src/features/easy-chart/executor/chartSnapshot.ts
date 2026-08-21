// Turn the merged chart-data response into the small view the executor needs.
//
// The executor never sees a FHIR resource or a DTO: it sees `{ resourceId, display }`. That keeps
// the handlers testable against a fake chart, and keeps the shape of "what is on the chart" in one
// readable place instead of spread across thirty handlers.
//
// The `display` here is what the model's wording is matched against for a removal, so it must be the
// text a provider would recognise — not an id, not a code.

import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
import { PlannedAction } from 'utils/lib/easy-chart/api';
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

export interface SnapshotOptions {
  examComponents?: typeof DefaultExamComponentsConfig;
}

export function buildChartSnapshot(
  chartData: GetChartDataResponse | undefined,
  options: SnapshotOptions = {}
): ChartSnapshot {
  const examComponents = options.examComponents ?? DefaultExamComponentsConfig;

  // An encounter charted under an OLDER exam layout carries observations whose field names the
  // current config does not define. Those get their raw field name as a label rather than being
  // dropped — an item the assistant cannot see is an item it will happily chart a second time. The
  // page should also offer the same one-click migration the regular chart does.
  const examLabels = new Map(buildExamLeafCatalogue(examComponents).map((leaf) => [leaf.field, leaf.label]));
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

    rosFindings: named(checked(chartData?.rosObservations), (o) => {
      // ROS field keys carry their polarity as a suffix; the provider reads "Denies fever", so a
      // removal must be matched against that, not against the bare symptom.
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
    // NEVER blank. `named` drops rows whose label is empty, and a procedure written without a
    // procedureType then becomes invisible to this snapshot — which means the duplicate check cannot see
    // it, so every run adds another one, and nothing can update or remove it either. Three identical
    // unnamed rows on one encounter is what that looks like. Fall back through the identifying fields the
    // row does have; a placeholder that can be matched beats a row that does not exist.
    procedures: named(
      chartData?.procedures,
      (p) =>
        p.procedureType?.trim() ||
        p.cptCodes?.[0]?.display?.trim() ||
        [p.bodySite, p.bodySide].filter(Boolean).join(' ').trim() ||
        'Procedure'
    ),

    cptCodes: withId(chartData?.cptCodes).map((cpt) => ({
      resourceId: cpt.resourceId,
      display: cpt.display,
      code: cpt.code,
    })),

    hasEmCode: Boolean(chartData?.emCode?.code),
  };
}

/**
 * Advance a snapshot by one APPLIED action.
 *
 * WHY THIS EXISTS. The snapshot used to be built once, before the run, and handed unchanged to every
 * step. That is wrong for any plan whose steps depend on each other, and the normal shape of a plan is
 * exactly that — the assessment is charted before the plan that references it. Three symptoms came from
 * the one cause, each reproduced by a test in easy-chart-executor.test.ts:
 *
 *  - a plan that charted a diagnosis and THEN ordered a send-out lab skipped the order, because the lab
 *    step read the pre-plan snapshot, saw no diagnosis, and refused;
 *  - a diagnosis SWAP (remove-diagnosis + add-diagnosis, which is what the review pass emits when it
 *    corrects a diagnosis) left the note with NO primary: the removed row was still in the snapshot, so
 *    the never-usurp rule demoted the replacement — even one explicitly marked primary;
 *  - a removal could not target something an earlier step in the same plan had just charted.
 *
 * Only APPLIED actions advance it: a skipped or failed step changed nothing. Kinds whose effect no later
 * step can observe are deliberate no-ops rather than exhaustively mapped — the point is to keep the
 * decisions handlers actually make honest, not to mirror the whole chart.
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
    procedures: [...snapshot.procedures],
    cptCodes: [...snapshot.cptCodes],
  };
  // A row charted mid-plan may not have a server id yet (the writer reports ids, but a fake or an order
  // path returns none). A synthetic key keeps list identity stable without pretending it is real.
  const id = createdIds[0] ?? `pending:${action.kind}:${action.display ?? action.code ?? ''}`;
  const display = (action.display ?? '').trim();

  const dropByDisplay = (items: ChartedItem[]): ChartedItem[] => {
    const needle = display.toLowerCase();
    if (!needle) return items;
    // The same containment rule the remove handler resolves with, so the snapshot drops the row the
    // handler actually removed rather than a different one that merely looks similar.
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
    case 'remove-condition':
      next.conditions = dropByDisplay(next.conditions);
      break;
    case 'add-allergy':
      next.allergies.push({ resourceId: id, display });
      break;
    case 'remove-allergy':
      next.allergies = dropByDisplay(next.allergies);
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
    case 'remove-surgical-history':
      next.surgicalHistory = dropByDisplay(next.surgicalHistory);
      break;
    case 'add-hospitalization':
      next.hospitalizations.push({ resourceId: id, display });
      break;
    case 'remove-hospitalization':
      next.hospitalizations = dropByDisplay(next.hospitalizations);
      break;
    case 'add-exam-finding':
      next.examFindings.push({ resourceId: id, display });
      break;
    case 'remove-exam-finding':
      next.examFindings = dropByDisplay(next.examFindings);
      break;
    case 'add-ros-finding':
      next.rosFindings.push({ resourceId: id, display });
      break;
    case 'remove-ros-finding':
      next.rosFindings = dropByDisplay(next.rosFindings);
      break;
    case 'add-cpt':
      next.cptCodes.push({ resourceId: id, display, code: action.code });
      break;
    case 'remove-cpt':
      next.cptCodes = next.cptCodes.filter((cpt) => cpt.code !== action.code);
      break;
    case 'set-em-code':
      next.hasEmCode = true;
      break;
    case 'remove-em-code':
      next.hasEmCode = false;
      break;
    case 'add-procedure':
      next.procedures.push({ resourceId: id, display });
      break;
    default:
      break;
  }
  return next;
}
