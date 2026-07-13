// An applied claim tag is `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }`; the tag's definition
// (description, system flag) is a separate Basic resource (see save-billing-tag).
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';

export const X12_ADJUSTMENT_GROUP_CODE = {
  contractualObligation: 'CO',
  correctionReversal: 'CR',
  otherAdjustment: 'OA',
  payerInitiated: 'PI',
  patientResponsibility: 'PR',
} as const;

export type X12AdjustmentGroupCode = (typeof X12_ADJUSTMENT_GROUP_CODE)[keyof typeof X12_ADJUSTMENT_GROUP_CODE];

// other CLP02 values render raw
export const ERA_CLAIM_STATUS_CODE = {
  primary: '1',
  secondary: '2',
  tertiary: '3',
  denied: '4',
  reversal: '22',
} as const;

export type EraClaimStatusCode = (typeof ERA_CLAIM_STATUS_CODE)[keyof typeof ERA_CLAIM_STATUS_CODE];
