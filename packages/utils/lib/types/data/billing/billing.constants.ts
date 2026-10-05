import { Patient, Task } from 'fhir/r4b';

// An applied claim tag is `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }`; the tag's definition
// (description, system flag) is a separate Basic resource (see save-billing-tag).
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';

export const TAG_NAME_FORBIDDEN_CHARACTERS = /[&=:,|\\$#%]|\p{C}|[^\S ]/u;
export const TAG_NAME_FORBIDDEN_CHARACTERS_ERROR =
  'Tag name cannot contain any of & = : , | \\ $ # %, or invisible and non-standard whitespace characters';

export const BILLING_CLAIM_TASK_CODING = {
  system: 'https://fhir.ottehr.com/billing/task',
  code: 'billing-claim',
};

export const BILLING_TASK_STATUSES = [
  'draft',
  'requested',
  'received',
  'accepted',
  'rejected',
  'ready',
  'cancelled',
  'in-progress',
  'on-hold',
  'failed',
  'completed',
  'entered-in-error',
] as const satisfies readonly Task['status'][];

export const BILLING_CLAIM_TASK_FILTER_STATUSES = [
  'requested',
  'in-progress',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly (typeof BILLING_TASK_STATUSES)[number][];

export const BILLING_CLAIM_TASK_PAYER_SCAN_LIMIT = 1_000;

export const CLAIM_STATUS_PROCESSED_TAG = {
  system: 'https://fhir.ottehr.com/billing/claim-status-processed',
  code: 'processed',
};

export const CREATE_TIMELY_FILING_REPORT_ZAMBDA = 'create-timely-filing-report';

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
  'net-collections',
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

// X12 drug quantity unit codes offered by the service line medication detail dialog.
export const DRUG_UNIT_CODE_VALUES = ['UN', 'ME', 'ML', 'GR', 'F2'] as const;
export type DrugUnitCode = (typeof DRUG_UNIT_CODE_VALUES)[number];
export const DRUG_UNIT_CODES: { code: DrugUnitCode; label: string; description: string }[] = [
  { code: 'UN', label: 'Units', description: 'Standard default for most drugs, procedures, or visits' },
  { code: 'ME', label: 'Milligrams', description: 'Drug amount in milligrams' },
  { code: 'ML', label: 'Milliliters', description: 'Drug amount in milliliters' },
  { code: 'GR', label: 'Grams', description: 'Drug amount in grams' },
  {
    code: 'F2',
    label: 'International Units',
    description: 'For specific biologicals/drugs; largely replaced by UN in 5010',
  },
];

// Only the 11-digit 5-4-2 NDC layout is supported. It is persisted as 11 plain digits and shown dashed.
export const NDC_REGEX = /^(?:\d{11}|\d{5}-\d{4}-\d{2})$/;
export const ndcToDigits = (ndc: string): string => ndc.replace(/-/g, '');
// Converts an NDC in a standard dashed layout (4-4-2, 5-3-2, 5-4-1 or 5-4-2) or as 11 plain digits into 11
// plain digits (5-4-2), zero-padding the short segment. Undashed 10-digit NDCs are ambiguous, so they and any
// other shape yield undefined.
export const normalizeNdcTo11Digits = (ndc: string): string | undefined => {
  const value = ndc.trim();
  if (/^\d{11}$/.test(value)) return value;
  const match = /^(\d{4,5})-(\d{3,4})-(\d{1,2})$/.exec(value);
  if (!match) return undefined;
  const [, labeler, product, pkg] = match;
  const length = labeler.length + product.length + pkg.length;
  if (length !== 10 && length !== 11) return undefined;
  return `${labeler.padStart(5, '0')}${product.padStart(4, '0')}${pkg.padStart(2, '0')}`;
};
// Values that aren't 11 digits (e.g. legacy entries) are shown as stored.
export const formatNdcForDisplay = (ndc: string): string => {
  const digits = ndcToDigits(ndc);
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}` : ndc;
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
