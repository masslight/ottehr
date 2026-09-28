// Lab results and radiology reports as one line of prose each, for a model prompt. Shared by the billing
// suggester and the Easy Chart planner so both prompts describe a result identically.

import { ExternalLabOrderResult, InHouseLabResult, NonNormalResult } from '../types/api/lab';
import { RadiologyDTO } from '../types/api/radiology';

/**
 * A resulted lab: its values, else the in-house single value, else just that a result came back. The lab's
 * non-normal flag is included, since "positive" alone does not say whether that is the abnormal answer.
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
 * The final report, else the preliminary; undefined when there is none. Reports are stored base64-encoded, and
 * one that does not decode is passed through as is.
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
