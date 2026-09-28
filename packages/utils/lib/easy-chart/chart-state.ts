// What is already on the chart, as prompt lines built server-side from a GetChartDataResponse. Never taken from
// the client: a caller-supplied summary would be caller-controlled text inside the model's instructions.

import { buildExamLeafCatalogue } from '../config-helpers/exam-leaves';
import { formatLabResultForPrompt, formatRadiologyReportForPrompt } from '../helpers/test-results-for-prompt';
import { DefaultExamComponentsConfig } from '../ottehr-config/examination/default-components.config';
import { getRosFindingStateFromKey } from '../ottehr-config/review-of-systems';
import { InPersonRosConfig } from '../ottehr-config/review-of-systems/in-person.config';
import { GetChartDataResponse } from '../types/api/chart-data/get-chart-data.types';

/**
 * The chart as display lines, not ids: the model must name an item back exactly for a remove-*, and the
 * server's removal guard matches against these lines.
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

  for (const vital of chart.vitalsObservations ?? []) {
    push('Vital already recorded', `${vital.field} = ${String(vital.value ?? '')}`);
  }

  // ROS with its polarity, since "Denies fever" and "Reports fever" are opposite entries. Read from
  // `rosObservations`, not the similarly named `observations` key.
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

  // Pending orders stop the model re-ordering; results are findings of this visit. A report is folded onto one
  // line because these lines are matched line by line (removals, chart-origin quotes).
  for (const order of chart.radiologyOrders ?? []) {
    const report = formatRadiologyReportForPrompt(order);
    if (report) push('Radiology reported', report.replace(/\s+/g, ' '));
    else push('Radiology already ordered', order.studyType);
  }
  for (const name of chart.externalLabResults?.resultsPending ?? []) push('External lab already ordered', name);
  for (const result of chart.externalLabResults?.labOrderResults ?? [])
    push('External lab resulted', formatLabResultForPrompt(result, 'external'));
  for (const name of chart.inHouseLabResults?.resultsPending ?? []) push('In-house lab already ordered', name);
  for (const result of chart.inHouseLabResults?.labOrderResults ?? [])
    push('In-house lab resulted', formatLabResultForPrompt(result, 'in-house'));

  for (const cpt of chart.cptCodes ?? []) push('CPT', `${cpt.code} ${cpt.display}`);
  push('E&M code already set', chart.emCode?.code);
  push('Disposition already set', chart.disposition?.type);
  for (const instruction of chart.instructions ?? []) push('Patient instruction', instruction.text);

  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * Labels of checked exam boxes. Kept apart from the summary because the prompt treats a checked box as a claim
 * the note makes, not merely something present.
 */
export function chartedExamFindingLabels(
  chart: GetChartDataResponse | undefined,
  examComponents: typeof DefaultExamComponentsConfig = DefaultExamComponentsConfig
): string[] {
  const labels = new Map(buildExamLeafCatalogue(examComponents).map((leaf) => [leaf.field, leaf.label]));
  return (
    (chart?.examObservations ?? [])
      .filter((observation) => observation.value === true)
      // Fields from an older exam layout keep their raw name rather than being dropped, or the model would
      // chart them again.
      .map((observation) => observation.label ?? labels.get(observation.field) ?? observation.field)
      .filter((label) => label.trim().length > 0)
  );
}

/** The free-text note fields, keyed as the prompt names them. */
export function buildNoteContextFromChart(chart: GetChartDataResponse | undefined): Record<string, string> | undefined {
  if (!chart) return undefined;
  // CC and HPI are stored swapped (see note-fields.ts), so each clinical name reads the other storage key.
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
