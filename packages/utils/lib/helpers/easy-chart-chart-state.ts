// Shared easy-chart planner-input builders. The chart-state summary and noteContext produced here
// are sent to the planner/review LLMs by the EHR client AND built server-side when precomputing a
// plan for an ambient-scribe transcript — the chartState string is the precomputed-plan
// cache-equality key, so both sides MUST build it byte-identically. Keep every formatting detail
// stable; any change invalidates existing cached plans (which is safe — they just miss).
import type { ExamItemConfig } from 'config-types';
import { examConfig, getRosFindingStateFromKey, RosFindingState } from '../ottehr-config';
import { EasyChartNoteContext, GetChartDataResponse } from '../types';
import type { ExamObservationDTO } from '../types/api/chart-data/chart-data.types';

// Walk examConfig once to map every leaf exam field name to its most-specific section label
// (e.g. "Right ear" inside the "Ears" card) so we can group abnormal findings by body section.
export function buildFieldToSectionLabel(config: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(config)) {
    const walk = (components: Record<string, unknown>, currentLabel: string): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as { type?: string; label?: string; components?: Record<string, unknown> };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          walk(c.components, c.label ?? currentLabel);
        } else {
          map[key] = currentLabel;
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label);
    walk(section.components.abnormal as Record<string, unknown>, section.label);
    walk(section.components.comment as Record<string, unknown>, section.label);
  }
  return map;
}

export const FIELD_TO_SECTION_LABEL = buildFieldToSectionLabel(examConfig.default.components);

// Human label for a charted ROS observation, e.g. "Denies Eye pain" — its polarity (from the
// field suffix) plus the symptom label.
export function rosObsLabel(o: ExamObservationDTO): string {
  const state = getRosFindingStateFromKey(o.field);
  const verb = state === RosFindingState.Denies ? 'Denies' : state === RosFindingState.Reports ? 'Reports' : '';
  return `${verb}${verb ? ' ' : ''}${o.label ?? o.field}`;
}

// The lab-order fields the chart-state summary reads. Lab orders live outside GetChartDataResponse
// (fetched from the lab-order zambdas client-side), so they're passed in separately; the client's
// EasyChartLabOrder is structurally assignable. Server-side precompute passes [] — when the client
// later has orders, its chartState differs and the cached plan correctly misses.
export interface EasyChartStateLabOrder {
  kind: 'in-house' | 'external';
  testName: string;
  labName?: string;
}

// Build a free-text summary of what's currently on the chart, for the planner refresh
// after apply-template. Only includes the categories the planner can emit add-* steps for.
export const buildEasyChartStateSummary = (
  data: GetChartDataResponse | null | undefined,
  labOrders: EasyChartStateLabOrder[]
): string => {
  if (!data) return '';
  const lines: string[] = [];
  if (data.diagnosis?.length) {
    lines.push(
      `Diagnoses: ${data.diagnosis.map((d) => `${d.code} — ${d.display}${d.isPrimary ? ' (primary)' : ''}`).join('; ')}`
    );
  }
  if (data.conditions?.length) {
    lines.push(`Past medical conditions: ${data.conditions.map((c) => `${c.code} — ${c.display}`).join('; ')}`);
  }
  if (data.medications?.length) {
    lines.push(`Medications: ${data.medications.map((m) => m.name).join('; ')}`);
  }
  if (data.allergies?.length) {
    lines.push(`Allergies: ${data.allergies.map((a) => a.name).join('; ')}`);
  }
  if (data.surgicalHistory?.length) {
    lines.push(`Surgical history: ${data.surgicalHistory.map((s) => s.display).join('; ')}`);
  }
  if (data.episodeOfCare?.length) {
    lines.push(`Hospitalizations: ${data.episodeOfCare.map((h) => h.display).join('; ')}`);
  }
  if (data.procedures?.length) {
    lines.push(
      `Procedures on encounter: ${data.procedures
        .map((p) => p.procedureType ?? p.cptCodes?.[0]?.display ?? 'procedure')
        .join('; ')}`
    );
  }
  const checkedExam = (data.examObservations ?? []).filter((o) => o.value === true);
  if (checkedExam.length > 0) {
    // Group by section label for readability.
    const bySection: Record<string, string[]> = {};
    for (const o of checkedExam) {
      const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
      const checked = (o.components ?? []).filter((c) => c.value);
      const label =
        checked.length > 0 ? `${o.label ?? o.field} (${checked.map((c) => c.label).join(', ')})` : o.label ?? o.field;
      (bySection[section] ??= []).push(label);
    }
    lines.push(
      'Exam findings already checked:\n' +
        Object.entries(bySection)
          .map(([sec, items]) => `  ${sec}: ${items.join('; ')}`)
          .join('\n')
    );
  }
  // ROS findings already charted (the pertinent positives/negatives). Without this, the review
  // pass can't see charted ROS and re-suggests "add the pertinent negatives you noted" for
  // negatives the planner already captured.
  const checkedRos = (data.rosObservations ?? []).filter((o) => o.value === true);
  if (checkedRos.length > 0) {
    lines.push('ROS findings already charted: ' + checkedRos.map((o) => rosObsLabel(o)).join('; '));
  }
  if (data.medicalDecision?.text?.trim()) {
    lines.push(`MDM already present (length ${data.medicalDecision.text.trim().length} chars).`);
  }
  if (data.emCode?.code) {
    lines.push(
      `E&M code already charted: ${data.emCode.code}${data.emCode.display ? ` — ${data.emCode.display}` : ''}.`
    );
  }
  // CPT + disposition lines: the review's "cpt" and "disposition" checks skip anything already
  // charted, and they can only see it through this summary.
  if (data.cptCodes?.length) {
    lines.push(
      `CPT codes already charted: ${data.cptCodes
        .map((c) => `${c.code}${c.display ? ` — ${c.display}` : ''}`)
        .join('; ')}`
    );
  }
  if (data.disposition?.type) {
    lines.push(
      `Disposition already set: ${data.disposition.type}${data.disposition.note ? ` — ${data.disposition.note}` : ''}`
    );
  }
  // Lab orders live outside chartData; include them so a re-plan doesn't re-order the same test.
  if (labOrders.length) {
    lines.push(
      `Labs already ordered: ${labOrders
        .map((o) => `${o.testName} (${o.kind === 'in-house' ? 'in-house' : o.labName ?? 'send-out'})`)
        .join('; ')}`
    );
  }
  return lines.join('\n');
};

// Build the noteContext sent to the LLM. The in-person CC↔HPI swap is applied here so
// the LLM sees text under the labels the provider reads (chiefComplaint = CC label's text).
// NOTE: the chiefComplaint↔historyOfPresentIllness cross-mapping below is intentional and must be
// preserved exactly — both the client's live planner calls and the server's precompute build the
// planner input through this one function, so changing it would invalidate parity.
export const buildEasyChartNoteContext = (ctx: GetChartDataResponse): EasyChartNoteContext => {
  return {
    chiefComplaint: ctx.historyOfPresentIllness?.text ?? undefined,
    historyOfPresentIllness: ctx.chiefComplaint?.text ?? undefined,
    mechanismOfInjury: ctx.mechanismOfInjury?.text ?? undefined,
    ros: ctx.ros?.text ?? undefined,
    medicalDecision: ctx.medicalDecision?.text ?? undefined,
  };
};
