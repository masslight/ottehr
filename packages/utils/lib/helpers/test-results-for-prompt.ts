// Lab results and radiology reports as ONE LINE OF PROSE each, for a model prompt.
//
// Two prompts describe the same results to a model: the assessment page's billing suggester (the client
// builds its request in useBillingSuggestions.ts) and the Easy Chart planner (chart-state.ts, server-side).
// They used to format them separately, and the planner's copy did not say what the result WAS — a resulted
// rapid strep read as "lab already ordered: Rapid strep". One formatter, two callers, so the two prompts
// describe a result identically and neither can drift from the other.

import { ExternalLabOrderResult, InHouseLabResult, NonNormalResult } from '../types/api/lab';
import { RadiologyDTO } from '../types/api/radiology';

/**
 * A resulted lab. The values when the result has them; otherwise the single value an in-house test records,
 * or the bare fact that a result came back — an external result with no parsed values is still a result.
 * A non-normal flag the lab attached rides along: "positive" alone does not say whether that is the
 * abnormal answer.
 */
export function formatLabResultForPrompt(
  result: ExternalLabOrderResult | InHouseLabResult,
  kind: 'external' | 'in-house'
): string {
  const parts = [`Test: ${result.name}`];
  if (result.resultValues?.length) {
    parts.push(`Results: ${result.resultValues.join(', ')}`);
  } else {
    const simple = kind === 'in-house' ? (result as InHouseLabResult).simpleResultValue : undefined;
    parts.push(`Result: ${simple ?? (kind === 'in-house' ? 'completed' : 'received')}`);
  }
  const flags = (result.nonNormalResultContained ?? []).filter((flag) => flag !== NonNormalResult.Neutral);
  if (flags.length > 0) parts.push(`Flag: ${flags.join(', ')}`);
  return parts.join(' | ');
}

/** A lab ordered whose result has not come back. */
export function formatPendingLabForPrompt(name: string): string {
  return `Test: ${name} | Result: PENDING`;
}

/**
 * A radiology order's read, when it has one: the final report, else the preliminary. The report is stored
 * base64-encoded (a DiagnosticReport presentedForm); one that does not decode is passed through as is
 * rather than dropped. Undefined for an order with no report yet.
 */
export function formatRadiologyReportForPrompt(order: RadiologyDTO): string | undefined {
  const report = order.finalReport || order.preliminaryReport;
  if (!report) return undefined;
  const reportType = order.finalReport ? 'Final' : 'Preliminary';
  try {
    return `${order.studyType} (${reportType}): ${atob(report)}`;
  } catch {
    return `${order.studyType} (${reportType}): ${report}`;
  }
}
