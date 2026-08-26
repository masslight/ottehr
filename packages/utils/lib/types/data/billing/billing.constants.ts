import { Patient } from 'fhir/r4b';

// An applied claim tag is `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }`; the tag's definition
// (description, system flag) is a separate Basic resource (see save-billing-tag).
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';

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

const ERA_CLAIM_STATUS_CODES = new Set<string>(Object.values(ERA_CLAIM_STATUS_CODE));

export function asEraClaimStatusCode(value: string | undefined): EraClaimStatusCode | '' {
  return value && ERA_CLAIM_STATUS_CODES.has(value) ? (value as EraClaimStatusCode) : '';
}

// what record-billing-manual-payment callers may send
export const BILLING_MANUAL_PAYMENT_METHODS = ['cash', 'check', 'other'] as const;

export const BILLING_RECORDABLE_PAYMENT_METHODS = [
  ...BILLING_MANUAL_PAYMENT_METHODS,
  'card-reader',
  'external-card-reader',
] as const;
