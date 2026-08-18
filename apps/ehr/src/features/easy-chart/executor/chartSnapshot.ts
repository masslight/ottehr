// Turn the merged chart-data response into the small view the executor needs.
//
// The executor never sees a FHIR resource or a DTO: it sees `{ resourceId, display }`. That keeps
// the handlers testable against a fake chart, and keeps the shape of "what is on the chart" in one
// readable place instead of spread across thirty handlers.
//
// The `display` here is what the model's wording is matched against for a removal, so it must be the
// text a provider would recognise — not an id, not a code.

import { buildExamLeafCatalogue } from 'utils/lib/config-helpers/exam-leaves';
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
    procedures: named(chartData?.procedures, (p) => p.procedureType ?? ''),

    cptCodes: withId(chartData?.cptCodes).map((cpt) => ({
      resourceId: cpt.resourceId,
      display: cpt.display,
      code: cpt.code,
    })),

    hasEmCode: Boolean(chartData?.emCode?.code),
  };
}
