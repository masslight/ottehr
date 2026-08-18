// THE rules that say a visit note isn't ready to sign, in one place.
//
// These lived in three copies: ReviewAndSignButton (the gate itself), MissingCard (the panel that
// lists what's missing), and a third private copy inside the Easy Chart feature. That third copy was
// the dangerous one — it re-implemented five of the rules and was MISSING four others (HPI, both
// accident fields, patient verification), so a provider could work the Easy Chart page to a clean
// warnings panel and still be refused at Review & Sign, with no idea why.
//
// Deliberately PURE and deliberately about CHART CONTENT only. Two other classes of blocker are not
// here because they aren't derivable from chart data:
//   - in-progress order DRAFTS (external lab, in-house lab, radiology, procedure, nursing order,
//     immunization, in-house med, vitals) — those live in client draft stores, keyed by encounter;
//   - appointment STATUS (must be discharged) and the signer's NPI — the visit's workflow state.
// ReviewAndSignButton keeps owning those, since it's the only surface with access to them.

import { AccidentDTO } from '../types/api/chart-data/chart-data.types';
import { EncounterInHouseLabResult } from '../types/api/lab';

/**
 * How ReviewAndSignButton bins these into user-facing messages. Keeping the grouping in the shared
 * rules lets that button reproduce its existing wording exactly (one collapsed "fill in the missing
 * data" line, separate lines for verification and labs) while Easy Chart shows them itemized.
 */
export type SignBlockerGroup = 'missing-data' | 'patient-info' | 'lab-results';

export interface SignBlocker {
  id: string;
  group: SignBlockerGroup;
  /** Itemized text, for surfaces that list blockers individually (the Easy Chart warnings panel). */
  text: string;
}

export interface SignBlockerInput {
  hasPrimaryDiagnosis: boolean;
  medicalDecision?: string;
  hasEmCode: boolean;
  /**
   * The HPI text. NOTE the CC↔HPI storage swap: Review & Sign reads this from
   * `chartFields.chiefComplaint.text`, and so must every other caller.
   */
  hpi?: string;
  patientInfoConfirmed?: boolean;
  accident?: AccidentDTO;
  inHouseLabResults?: EncounterInHouseLabResult;
  /**
   * From the practice's progress-note config. Defaults to required at the call sites, matching the
   * `progressNoteConfig?.mdmRequired ?? true` those sites already used.
   */
  mdmRequired: boolean;
}

export function computeSignBlockers(input: SignBlockerInput): SignBlocker[] {
  const blockers: SignBlocker[] = [];
  const isAutoAccident = input.accident?.type?.includes('AA') ?? false;
  const hasAccidentType = (input.accident?.type?.length ?? 0) > 0;

  if (!input.hasPrimaryDiagnosis) {
    blockers.push({ id: 'no-primary-dx', group: 'missing-data', text: 'No primary diagnosis is set.' });
  }
  if (input.mdmRequired && !input.medicalDecision?.trim()) {
    blockers.push({ id: 'no-mdm', group: 'missing-data', text: 'Medical Decision Making is required to sign.' });
  }
  if (!input.hasEmCode) {
    blockers.push({ id: 'no-em', group: 'missing-data', text: 'No E&M level is set.' });
  }
  if (!input.hpi?.trim()) {
    blockers.push({ id: 'no-hpi', group: 'missing-data', text: 'History of Present Illness is empty.' });
  }
  if (hasAccidentType && !input.accident?.date) {
    blockers.push({ id: 'accident-no-date', group: 'missing-data', text: 'The accident is missing its date.' });
  }
  if (isAutoAccident && !input.accident?.state) {
    blockers.push({ id: 'accident-no-state', group: 'missing-data', text: 'The auto accident is missing its state.' });
  }
  if (!input.patientInfoConfirmed) {
    blockers.push({
      id: 'patient-info-unconfirmed',
      group: 'patient-info',
      text: "Patient's name and date of birth are not verified.",
    });
  }
  // BEHAVIOUR CHANGE, deliberate: ReviewAndSignButton used to test `if (inHouseLabResultsPending)` —
  // the truthiness of the ARRAY, and an empty array is truthy in JS. So `resultsPending: []` blocked
  // signing with "In-House lab results pending" when nothing was actually pending. Easy Chart's own
  // copy of this rule always used length, so the two surfaces already disagreed here; length is the
  // correct reading. Note this LOOSENS the sign gate in that one case — if that case turns out to be
  // load-bearing somewhere, this is the line to revisit.
  if ((input.inHouseLabResults?.resultsPending?.length ?? 0) > 0) {
    blockers.push({ id: 'inhouse-lab-results-pending', group: 'lab-results', text: 'In-house lab results pending.' });
  }
  for (const test of input.inHouseLabResults?.reflexTestsPending ?? []) {
    blockers.push({
      id: `reflex-test-pending-${test}`,
      group: 'lab-results',
      text: `In-house lab results have triggered a reflex test for ${test}.`,
    });
  }
  return blockers;
}

/**
 * The messages ReviewAndSignButton shows, derived from the same rules: the missing-data group
 * collapses to one line, patient verification and lab results get their own. Reproduces the button's
 * existing wording exactly.
 */
export function signBlockerMessages(blockers: SignBlocker[]): string[] {
  const messages: string[] = [];
  if (blockers.some((b) => b.group === 'missing-data')) {
    messages.push('You need to fill in the missing data');
  }
  if (blockers.some((b) => b.id === 'patient-info-unconfirmed')) {
    messages.push('You need to confirm patient information');
  }
  if (blockers.some((b) => b.id === 'inhouse-lab-results-pending')) {
    messages.push('In-House lab results pending');
  }
  for (const blocker of blockers) {
    if (blocker.id.startsWith('reflex-test-pending-')) {
      messages.push(
        `In-House lab results have triggered a reflex test for ${blocker.id.slice('reflex-test-pending-'.length)}`
      );
    }
  }
  return messages;
}
