import { Patient } from 'fhir/r4b';

// An applied claim tag is `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }`; the tag's definition
// (description, system flag) is a separate Basic resource (see save-billing-tag).
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';

// Task code (under EXPORT_TASK_SYSTEM) for a claims-list CSV export, and the codes its Task inputs
// and outputs carry. The Subscription that runs the export matches on the code.
export const EXPORT_CLAIMS_CSV_TASK_CODE = 'export-billing-claims-csv';
export const EXPORT_CLAIMS_FILTERS_CODE = 'export-claims-filters';
export const EXPORT_CLAIMS_INCOMPLETE_CODE = 'export-claims-incomplete';

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

// X12 drug quantity unit codes offered by the service line medication detail dialog.
export const DRUG_UNIT_CODE_VALUES = ['UN', 'ME', 'ML', 'GM', 'F2', 'MJ'] as const;
export type DrugUnitCode = (typeof DRUG_UNIT_CODE_VALUES)[number];
export const DRUG_UNIT_CODES: { code: DrugUnitCode; label: string; description: string }[] = [
  { code: 'UN', label: 'Units', description: 'Standard default for most drugs, procedures, or visits' },
  { code: 'ME', label: 'Milligrams (MG)', description: 'Drug amount in milligrams' },
  { code: 'ML', label: 'Milliliters (ML)', description: 'Drug amount in milliliters' },
  { code: 'GM', label: 'Grams (GM)', description: 'Drug amount in grams' },
  {
    code: 'F2',
    label: 'International Units',
    description: 'For specific biologicals/drugs; largely replaced by UN in 5010',
  },
  { code: 'MJ', label: 'Minutes', description: 'Time-based modalities billed in increments' },
];

// Dashed NDC layouts by digit count: 10 → 4-4-2 / 5-3-2 / 5-4-1, 11 → 5-4-2, 12 → 6-4-2.
export const NDC_DASH_FORMATS: Record<number, readonly (readonly [number, number, number])[]> = {
  10: [
    [4, 4, 2],
    [5, 3, 2],
    [5, 4, 1],
  ],
  11: [[5, 4, 2]],
  12: [[6, 4, 2]],
};
// Plain 10-12 digits, or dashed per an allowed layout (dashes are validated only when present).
export const NDC_REGEX = /^(?:\d{10,12}|\d{4}-\d{4}-\d{2}|\d{5}-\d{3}-\d{2}|\d{5}-\d{4}-\d{1,2}|\d{6}-\d{4}-\d{2})$/;
export const formatNdc = (digits: string, [a, b]: readonly [number, number, number]): string =>
  `${digits.slice(0, a)}-${digits.slice(a, a + b)}-${digits.slice(a + b)}`;
// Undashed entries default to the first layout for their length (10 → 4-4-2, 11 → 5-4-2, 12 → 6-4-2).
export const normalizeNdc = (ndc: string): string => {
  if (ndc.includes('-')) return ndc;
  const format = NDC_DASH_FORMATS[ndc.length]?.[0];
  return format ? formatNdc(ndc, format) : ndc;
};

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
