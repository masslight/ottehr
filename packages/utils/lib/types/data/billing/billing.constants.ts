import { Patient } from 'fhir/r4b';

// An applied claim tag is `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }`; the tag's definition
// (description, system flag) is a separate Basic resource (see save-billing-tag).
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';

export const CLAIM_STATUS_PROCESSED_TAG = {
  system: 'https://fhir.ottehr.com/billing/claim-status-processed',
  code: 'processed',
};

// Task code (under EXPORT_TASK_SYSTEM) for a claims-list CSV export, and the codes its Task inputs
// and outputs carry. The Subscription that runs the export matches on the code.
export const EXPORT_CLAIMS_CSV_TASK_CODE = 'export-billing-claims-csv';
export const EXPORT_CLAIMS_FILTERS_CODE = 'export-claims-filters';
export const EXPORT_CLAIMS_INCOMPLETE_CODE = 'export-claims-incomplete';

// Async billing-report refresh Task: kind/params/cacheKey travel as Task inputs; the
// Subscription matches on the code.
export const REFRESH_REPORT_TASK_CODE = 'refresh-billing-report';
export const REFRESH_REPORT_KIND_CODE = 'refresh-report-kind';
export const REFRESH_REPORT_PARAMS_CODE = 'refresh-report-params';
export const REFRESH_REPORT_CACHE_KEY_CODE = 'refresh-report-cache-key';
// continuation depth of a chained multi-run refresh (bounds runaway chains)
export const REFRESH_REPORT_CHAIN_CODE = 'refresh-report-chain';
export const REFRESH_REPORT_KINDS = [
  'payments',
  'patient-payments',
  'invoice',
  'cards-on-file',
  'pipeline',
  'productivity',
] as const;
export type RefreshReportKind = (typeof REFRESH_REPORT_KINDS)[number];

// Max claims a single CSV export includes; matches beyond this are truncated and flagged incomplete.
export const EXPORT_CLAIMS_MATCH_LIMIT = 10_000;

// Max claims a service date search scans. Claim has no service-date search parameter, so that filter
// runs in memory and the scan has to hold every match at once; without a ceiling a wide range fills
// the lambda. Matches beyond this are dropped and the result is flagged incomplete.
export const CLAIM_SCAN_MATCH_LIMIT = 10_000;

// FHIR administrative gender, labeled the way the billing app displays it. The demographics forms,
// the rules field catalog, and the engine's gender writer all share this one list.
export const PERSON_GENDER_OPTIONS: { value: NonNullable<Patient['gender']>; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

export const X12_ADJUSTMENT_GROUP_CODE = {
  contractualObligation: 'CO',
  correctionReversal: 'CR',
  otherAdjustment: 'OA',
  payerInitiated: 'PI',
  patientResponsibility: 'PR',
} as const;

export type X12AdjustmentGroupCode = (typeof X12_ADJUSTMENT_GROUP_CODE)[keyof typeof X12_ADJUSTMENT_GROUP_CODE];

export const X12_ADJUSTMENT_GROUP_CODES = [
  X12_ADJUSTMENT_GROUP_CODE.contractualObligation,
  X12_ADJUSTMENT_GROUP_CODE.correctionReversal,
  X12_ADJUSTMENT_GROUP_CODE.otherAdjustment,
  X12_ADJUSTMENT_GROUP_CODE.payerInitiated,
  X12_ADJUSTMENT_GROUP_CODE.patientResponsibility,
] as const;

// X12 835 (TR3) CLP02 claim status codes carried by ERA remits
export const ERA_CLAIM_STATUS_CODE = {
  primary: '1',
  secondary: '2',
  tertiary: '3',
  denied: '4',
  primaryForwarded: '19',
  secondaryForwarded: '20',
  tertiaryForwarded: '21',
  reversal: '22',
  notOurClaimForwarded: '23',
  predetermination: '25',
} as const;

export type EraClaimStatusCode = (typeof ERA_CLAIM_STATUS_CODE)[keyof typeof ERA_CLAIM_STATUS_CODE];

export const ERA_CLAIM_STATUS_CODES = [
  ERA_CLAIM_STATUS_CODE.primary,
  ERA_CLAIM_STATUS_CODE.secondary,
  ERA_CLAIM_STATUS_CODE.tertiary,
  ERA_CLAIM_STATUS_CODE.denied,
  ERA_CLAIM_STATUS_CODE.primaryForwarded,
  ERA_CLAIM_STATUS_CODE.secondaryForwarded,
  ERA_CLAIM_STATUS_CODE.tertiaryForwarded,
  ERA_CLAIM_STATUS_CODE.reversal,
  ERA_CLAIM_STATUS_CODE.notOurClaimForwarded,
  ERA_CLAIM_STATUS_CODE.predetermination,
] as const;

const ERA_CLAIM_STATUS_CODE_SET = new Set<string>(ERA_CLAIM_STATUS_CODES);

export function asEraClaimStatusCode(value: string | undefined): EraClaimStatusCode | '' {
  return value && ERA_CLAIM_STATUS_CODE_SET.has(value) ? (value as EraClaimStatusCode) : '';
}

// Where an ERA came from: keyed in by a biller from a paper/PDF remit, pasted in as an X12 835, or
// delivered by the clearing house.
export const ERA_SOURCE = {
  manual: 'manual',
  x12Import: 'x12-import',
  clearingHouse: 'clearing-house',
} as const;

export type EraSource = (typeof ERA_SOURCE)[keyof typeof ERA_SOURCE];

// X12 835 BPR04 payment method codes a manual remit can record, with the labels billers see.
export const ERA_PAYMENT_METHODS = [
  { code: 'ACH', label: 'EFT' },
  { code: 'CHK', label: 'Check' },
  { code: 'FWT', label: 'Wire Transfer' },
  { code: 'BOP', label: 'Financial Institution Option' },
  { code: 'NON', label: 'Non-Payment' },
] as const;

export type EraPaymentMethodCode = (typeof ERA_PAYMENT_METHODS)[number]['code'];

export const ERA_PAYMENT_METHOD_CODES = ERA_PAYMENT_METHODS.map((method) => method.code) as [
  EraPaymentMethodCode,
  ...EraPaymentMethodCode[],
];

// Limits for manually keyed remits: text lengths follow the 835 elements they stand for (TRN02,
// CLP01, CLP07, NM109); the counts keep one save inside a single FHIR transaction.
export const MANUAL_ERA_LIMITS = {
  checkNumberLength: 50,
  patientAccountNumberLength: 38,
  payerClaimControlNumberLength: 50,
  memberIdLength: 80,
  patientNameLength: 120,
  notesLength: 2000,
  claimsPerRemit: 100,
  serviceLinesPerClaim: 50,
  adjustmentsPerLine: 20,
  remarkCodesPerLine: 10,
} as const;

// what record-billing-manual-payment callers may send
export const BILLING_MANUAL_PAYMENT_METHODS = ['cash', 'check', 'other'] as const;

export const BILLING_RECORDABLE_PAYMENT_METHODS = [
  ...BILLING_MANUAL_PAYMENT_METHODS,
  'card-reader',
  'external-card-reader',
] as const;
