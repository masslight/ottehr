// What is already on the chart, as prose for the prompt — built from the chart-data response itself.
//
// SERVER-SIDE BY DESIGN. This used to be assembled in the browser and posted to the zambda, and that was
// wrong in three ways that all showed up as missing data: the client could only send the sections its own
// read layer happened to fetch (ROS and vitals were silently absent, so the model re-charted them), the
// two sides drifted whenever a field was added on one of them, and a caller-supplied summary is
// caller-controlled text landing inside the model's instructions.
//
// The visit-note PDF path already does it the right way — see assemble-progress-note-input.ts, which calls
// get-chart-data twice by encounterId and never trusts a client payload. This module is the same idea for
// the prompt: one pure function over a GetChartDataResponse, so the plan and review surfaces describe an
// identical chart and a unit test can pin what they say about it.

import { buildExamLeafCatalogue } from '../config-helpers/exam-leaves';
import { DefaultExamComponentsConfig } from '../ottehr-config/examination/default-components.config';
import { getRosFindingStateFromKey } from '../ottehr-config/review-of-systems';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import { GetChartDataResponse } from '../types/api/chart-data/get-chart-data.types';

/**
 * The chart as a list of displays. Deliberately displays and not ids: the model needs to know an item
 * EXISTS so it neither duplicates it nor invents a removal, and it must be able to name it back exactly
 * for a remove-*, which the server's removal guard matches against these very lines.
 */
export function buildChartStateSummary(chart: GetChartDataResponse | undefined): string | undefined {
  if (!chart) return undefined;
  const lines: string[] = [];
  const push = (label: string, value: string | undefined): void => {
    if (value?.trim()) lines.push(`- ${label}: ${value.trim()}`);
  };

  for (const dx of chart.diagnosis ?? []) {
    push(`Diagnosis${dx.isPrimary ? ' (primary)' : ''}`, `${dx.display}${dx.code ? ` [${dx.code}]` : ''}`);
  }
  for (const allergy of chart.allergies ?? []) push('Allergy', allergy.name);
  for (const condition of chart.conditions ?? []) push('Past medical history', condition.display);
  for (const medication of chart.medications ?? []) push('Medication', medication.name);
  for (const surgery of chart.surgicalHistory ?? []) push('Surgical history', surgery.display);
  for (const stay of chart.episodeOfCare ?? []) push('Hospitalization', stay.display);
  for (const medication of chart.inhouseMedications ?? []) push('In-house medication given', medication.name);
  for (const medication of chart.prescribedMedications ?? []) push('Prescription already ordered', medication.name);
  for (const procedure of chart.procedures ?? []) {
    push('Procedure already charted', procedure.procedureType ?? procedure.cptCodes?.[0]?.display);
  }

  // Vitals. Absent before, which meant the model could not see a reading the nurse had already entered —
  // so it charted it a second time, and had nothing to reason from when picking an E&M level.
  for (const vital of chart.vitalsObservations ?? []) {
    push('Vital already recorded', `${vital.field} = ${String(vital.value ?? '')}`);
  }

  // ROS, with its polarity. "Denies fever" and "Reports fever" are opposite chart entries, and without the
  // word the model cannot tell which one exists. Read from `rosObservations` — NOT from `observations`,
  // which is a different key and is empty on every response we have looked at.
  const rosLabels = new Map(
    Object.values(InPersonRosConfig).flatMap((system) =>
      Object.entries(system.items).map(([baseField, item]) => [baseField, `${system.label}: ${item.label}`])
    )
  );
  for (const observation of chart.rosObservations ?? []) {
    if (observation.value !== true) continue;
    const state = getRosFindingStateFromKey(observation.field);
    const base = state ? observation.field.slice(0, -(state.length + 1)) : observation.field;
    const label = rosLabels.get(base) ?? observation.label ?? base;
    push('ROS already charted', state ? `${state === 'denies' ? 'Denies' : 'Reports'} ${label}` : label);
  }

  // Orders already placed. Without these the model re-orders a test that is already pending; the narrative
  // backstop only catches the ones the provider said aloud WITH a result.
  for (const order of chart.radiologyOrders ?? []) push('Radiology already ordered', order.studyType);
  for (const result of chart.externalLabResults?.labOrderResults ?? [])
    push('External lab already ordered', result.name);
  for (const result of chart.inHouseLabResults?.labOrderResults ?? [])
    push('In-house lab already ordered', result.name);

  for (const cpt of chart.cptCodes ?? []) push('CPT', `${cpt.code} ${cpt.display}`);
  push('E&M code already set', chart.emCode?.code);
  push('Disposition already set', chart.disposition?.type);
  for (const instruction of chart.instructions ?? []) push('Patient instruction', instruction.text);

  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * Exam findings that are CHECKED. Travels separately from the summary because the prompt tells the model a
 * different thing about it: exam boxes are positive/abnormal assertions, so "already checked" means
 * something the note is claiming, not merely something present.
 */
export function chartedExamFindingLabels(
  chart: GetChartDataResponse | undefined,
  examComponents: typeof DefaultExamComponentsConfig = DefaultExamComponentsConfig
): string[] {
  const labels = new Map(buildExamLeafCatalogue(examComponents).map((leaf) => [leaf.field, leaf.label]));
  return (
    (chart?.examObservations ?? [])
      .filter((observation) => observation.value === true)
      // An encounter charted under an OLDER exam layout carries fields the current config does not define.
      // Those keep their raw field name rather than being dropped: an item the model cannot see is an item
      // it will happily chart a second time.
      .map((observation) => observation.label ?? labels.get(observation.field) ?? observation.field)
      .filter((label) => label.trim().length > 0)
  );
}

/** The free-text note fields, keyed as the prompt names them. */
export function buildNoteContextFromChart(chart: GetChartDataResponse | undefined): Record<string, string> | undefined {
  if (!chart) return undefined;
  // The CC↔HPI storage swap is real and deliberate — see note-fields.ts. The CLINICAL name goes on the
  // wire, so what a provider calls Chief Complaint is read from the historyOfPresentIllness key.
  const pairs: [string, string | undefined][] = [
    ['chiefComplaint', chart.historyOfPresentIllness?.text],
    ['historyOfPresentIllness', chart.chiefComplaint?.text],
    ['mechanismOfInjury', chart.mechanismOfInjury?.text],
    ['medicalDecision', chart.medicalDecision?.text],
  ];
  const out: Record<string, string> = {};
  for (const [field, text] of pairs) if (text?.trim()) out[field] = text;
  return Object.keys(out).length > 0 ? out : undefined;
}
