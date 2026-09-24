import { roundNumberToDecimalPlaces } from '../../../utils/convert';
import { X12_ADJUSTMENT_GROUP_CODE, X12AdjustmentGroupCode } from './billing.constants';
import type { ClaimRemitAdjustment } from './billing.types';
import { CARC_CODE_LIST } from './carc-codes.generated';
import type { X12CodeListEntry } from './x12-code-list';

export const X12_ADJUSTMENT_GROUP_LABELS: Record<X12AdjustmentGroupCode, string> = {
  [X12_ADJUSTMENT_GROUP_CODE.contractualObligation]: 'Contractual Obligation',
  [X12_ADJUSTMENT_GROUP_CODE.correctionReversal]: 'Correction/Reversal',
  [X12_ADJUSTMENT_GROUP_CODE.otherAdjustment]: 'Other Adjustment',
  [X12_ADJUSTMENT_GROUP_CODE.payerInitiated]: 'Payer Initiated Reduction',
  [X12_ADJUSTMENT_GROUP_CODE.patientResponsibility]: 'Patient Responsibility',
};

// The CARCs that split a PR-group adjustment into the classic patient-responsibility buckets.
export const PATIENT_RESP_CARC = {
  deductible: '1',
  coinsurance: '2',
  copay: '3',
} as const;

// Current X12 claim adjustment reason codes (CARC, external code list 139), in X12 order: the codes
// a biller may pick when keying in a remit.
export const CARC_OPTIONS: readonly X12CodeListEntry[] = CARC_CODE_LIST;

// Deactivated codes older ERAs still carry. Never offered for new entries, but their remits keep a
// description.
const DEACTIVATED_CARC_DESCRIPTIONS: Record<string, string> = {
  '15': 'The authorization number is missing, invalid, or does not apply to the billed services or provider.',
  '138': 'Appeal procedures not followed or time limits not met.',
  '162':
    'State-mandated requirement for property and casualty, see claim payment remarks code for specific explanation.',
  '168':
    "Service(s) have been considered under the patient's medical plan. Benefits are not available under this dental plan.",
  '191': "Not a work related injury/illness and thus not the liability of the workers' compensation carrier.",
};

// CARC -> official description (without X12's payer-facing "Usage:" guidance). Unknown codes render
// a generic label via carcDescription().
export const CARC_DESCRIPTIONS: Record<string, string> = {
  ...DEACTIVATED_CARC_DESCRIPTIONS,
  ...Object.fromEntries(CARC_CODE_LIST.map(({ code, description }) => [code, description])),
};

export function carcDescription(code: string): string | undefined {
  return CARC_DESCRIPTIONS[code];
}

export interface PatientRespBuckets {
  deductible: number;
  coinsurance: number;
  copay: number;
  // PR-group adjustments with any other (or absent) CARC
  other: number;
}

// Sums PR-group CAS adjustments into deductible (PR-1) / coinsurance (PR-2) / copay (PR-3),
// cent-rounded. Adjustments in other groups are ignored.
export function patientRespBuckets(adjustments: ClaimRemitAdjustment[]): PatientRespBuckets {
  const buckets = { deductible: 0, coinsurance: 0, copay: 0, other: 0 };
  for (const adjustment of adjustments) {
    if (adjustment.groupCode !== X12_ADJUSTMENT_GROUP_CODE.patientResponsibility) continue;
    if (adjustment.reasonCode === PATIENT_RESP_CARC.deductible) buckets.deductible += adjustment.amount;
    else if (adjustment.reasonCode === PATIENT_RESP_CARC.coinsurance) buckets.coinsurance += adjustment.amount;
    else if (adjustment.reasonCode === PATIENT_RESP_CARC.copay) buckets.copay += adjustment.amount;
    else buckets.other += adjustment.amount;
  }
  return {
    deductible: roundNumberToDecimalPlaces(buckets.deductible, 2),
    coinsurance: roundNumberToDecimalPlaces(buckets.coinsurance, 2),
    copay: roundNumberToDecimalPlaces(buckets.copay, 2),
    other: roundNumberToDecimalPlaces(buckets.other, 2),
  };
}
