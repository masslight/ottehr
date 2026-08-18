import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ConversationTurn } from 'utils/lib/easy-chart/api';

/**
 * The authoritative patient line for the prompt. Deliberately minimal: age and sex are what the
 * model needs to code correctly, and everything else (name, address, insurance) is both irrelevant
 * to charting and PHI we have no reason to send.
 */
export function describePatient(patient: Patient): string {
  const parts: string[] = [];
  if (patient.birthDate) {
    const birth = DateTime.fromISO(patient.birthDate);
    if (birth.isValid) {
      const months = Math.floor(DateTime.now().diff(birth, 'months').months);
      parts.push(months < 24 ? `Age: ${months} month(s)` : `Age: ${Math.floor(months / 12)} years`);
    }
  }
  parts.push(`Sex: ${patient.gender ?? 'unknown'}`);
  return parts.join(', ');
}

/**
 * The bounded conversation digest (Phase 5.7b).
 *
 * SUMMARISE ASSISTANT TURNS, QUOTE PROVIDER TURNS. What the provider SAID is evidence and must be
 * verbatim; what the assistant DID is already in the chart state, so one line per action is enough.
 * The window itself is capped in validateRequestParameters — every turn re-sends it, so an uncapped
 * window makes cost grow superlinearly.
 */
export function buildHistoryDigest(history?: ConversationTurn[]): string | undefined {
  if (!history?.length) return undefined;
  const lines = history.map((turn) => {
    if (turn.role === 'provider') return `provider: ${turn.text ?? ''}`;
    const charted = turn.charted?.length ? `charted ${turn.charted.join('; ')}` : undefined;
    const skipped = turn.skipped?.length ? `skipped ${turn.skipped.join('; ')}` : undefined;
    const summary = [charted, skipped].filter(Boolean).join(' · ');
    return `assistant: ${summary || 'nothing was charted'}`;
  });
  return lines.join('\n');
}
