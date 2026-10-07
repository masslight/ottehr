import { roundNumberToDecimalPlaces } from '../../../utils/convert';
import { X12_ADJUSTMENT_GROUP_CODE, X12AdjustmentGroupCode } from './billing.constants';
import type { ClaimRemitAdjustment } from './billing.types';
import { CARC_CODE_LIST } from './carc-codes.generated';
import type { RemitCodeEntry } from './remit-codes';

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

// The claim adjustment reason codes (CARCs) a biller may pick when keying in a remit, in code order.
// Older codes are included, since a paper remit is keyed as printed.
export const CARC_OPTIONS: readonly RemitCodeEntry[] = CARC_CODE_LIST;

// CARC -> plain-language description. Unknown codes render a generic label via carcDescription().
export const CARC_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  CARC_CODE_LIST.map(({ code, description }) => [code, description])
);

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
