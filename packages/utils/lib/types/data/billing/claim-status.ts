import { Claim } from 'fhir/r4b';

/**
 * Billing claim status indicators.
 *
 * Each status field is stored as a single `meta.tag` on the FHIR Claim resource under its own
 * `system`; the tag's `code` holds the current value. Absence of the tag means the field is at its
 * default value (see `defaultCode`) — so the "default" / "null state" options described by the
 * product spec are represented by the tag simply not being present.
 *
 * A single registry (`CLAIM_STATUS_FIELDS`) drives the list grid columns, the claim-detail
 * dropdowns, the status chips, and the backend read/write paths, so the set of fields and their
 * allowed values is defined in exactly one place.
 *
 * NOTE: this is distinct from the legacy `current-status` tag (see CURRENT_STATUS_TAG_SYSTEM in the
 * billing zambdas), which is still used by the EHR RCM claims queue and is intentionally left alone.
 */

// Ordered list of field keys. Doubles as the source of truth for value-bearing types and the
// setter zambda's `field` enum.
export const CLAIM_STATUS_FIELD_KEYS = [
  'arStage',
  'insuranceStatus',
  'insurancePaidStatus',
  'adjudicationStatus',
  'patientArStatus',
  'patientPaidStatus',
  'nonInsuranceArStatus',
  'nonInsurancePaidStatus',
] as const;

export type ClaimStatusFieldKey = (typeof CLAIM_STATUS_FIELD_KEYS)[number];

export const CLAIM_STATUS_TAG_SYSTEMS: Record<ClaimStatusFieldKey, string> = {
  arStage: 'https://ottehr.com/billing/ar-stage',
  insuranceStatus: 'https://ottehr.com/billing/insurance-status',
  insurancePaidStatus: 'https://ottehr.com/billing/insurance-paid-status',
  adjudicationStatus: 'https://ottehr.com/billing/adjudication-status',
  patientArStatus: 'https://ottehr.com/billing/patient-ar-status',
  patientPaidStatus: 'https://ottehr.com/billing/patient-paid-status',
  nonInsuranceArStatus: 'https://ottehr.com/billing/non-insurance-ar-status',
  nonInsurancePaidStatus: 'https://ottehr.com/billing/non-insurance-paid-status',
};

// Conceptual groupings of the status fields. AR Stage stands on its own as the top-level field, so
// it has no group. The remaining fields cluster by which receivable they track.
export type ClaimStatusGroupKey = 'insurance' | 'patient' | 'nonInsurance';

export interface ClaimStatusGroupDef {
  key: ClaimStatusGroupKey;
  label: string;
  // The AR Stage value that makes this group the "active" one (its statuses are the ones in play).
  arStageCode: string;
  // The field tracking progress through this AR stage. Initialized to its first value when the claim
  // first enters the stage (so it doesn't sit at "None").
  primaryFieldKey: ClaimStatusFieldKey;
}

export const CLAIM_STATUS_GROUPS: ClaimStatusGroupDef[] = [
  { key: 'insurance', label: 'Insurance', arStageCode: 'insurance-payer-ar', primaryFieldKey: 'insuranceStatus' },
  { key: 'patient', label: 'Patient', arStageCode: 'patient-ar', primaryFieldKey: 'patientArStatus' },
  {
    key: 'nonInsurance',
    label: 'Non-insurance',
    arStageCode: 'non-insurance-payer-ar',
    primaryFieldKey: 'nonInsuranceArStatus',
  },
];

// The status group relevant to a given AR Stage value, if any (undefined when no AR Stage is set).
export function getActiveStatusGroup(arStageCode: string | undefined): ClaimStatusGroupDef | undefined {
  if (!arStageCode) return undefined;
  return CLAIM_STATUS_GROUPS.find((group) => group.arStageCode === arStageCode);
}

export interface ClaimStatusOption {
  code: string;
  label: string;
}

export interface ClaimStatusFieldDef {
  key: ClaimStatusFieldKey;
  label: string;
  system: string;
  options: ClaimStatusOption[];
  /**
   * Code applied when the tag is absent. `null` means the default is "no value" — the field renders
   * blank and exposes a "None" choice so users can clear it back to the null state.
   */
  defaultCode: string | null;
  // Conceptual group this field belongs to, or undefined for the standalone AR Stage field.
  group?: ClaimStatusGroupKey;
}

// Paid-status options are shared by the three "...Paid Status" fields.
const PAID_STATUS_OPTIONS: ClaimStatusOption[] = [
  { code: 'unpaid', label: 'Unpaid' },
  { code: 'partially-paid', label: 'Partially paid' },
  { code: 'fully-paid', label: 'Fully paid' },
];

export const CLAIM_STATUS_FIELDS: ClaimStatusFieldDef[] = [
  {
    key: 'arStage',
    label: 'AR Stage',
    system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
    defaultCode: null,
    options: [
      { code: 'insurance-payer-ar', label: 'Insurance Payer AR' },
      { code: 'patient-ar', label: 'Patient AR' },
      { code: 'non-insurance-payer-ar', label: 'Non-insurance Payer AR' },
    ],
  },
  {
    key: 'insuranceStatus',
    label: 'Insurance Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.insuranceStatus,
    group: 'insurance',
    defaultCode: null,
    options: [
      { code: 'created', label: 'Created' },
      { code: 'submitted', label: 'Submitted' },
      { code: 'adjudicated', label: 'Adjudicated' },
      { code: 'finalized', label: 'Finalized' },
    ],
  },
  {
    key: 'insurancePaidStatus',
    label: 'Insurance Paid Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.insurancePaidStatus,
    group: 'insurance',
    defaultCode: null,
    options: PAID_STATUS_OPTIONS,
  },
  {
    key: 'adjudicationStatus',
    label: 'Adjudication Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.adjudicationStatus,
    group: 'insurance',
    defaultCode: null,
    options: [
      { code: 'approved', label: 'Approved' },
      { code: 'rejected', label: 'Rejected' },
      { code: 'denied', label: 'Denied' },
    ],
  },
  {
    key: 'patientArStatus',
    label: 'Patient AR Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus,
    group: 'patient',
    defaultCode: null,
    options: [
      { code: 'not-invoiced', label: 'Not invoiced' },
      { code: 'ready-to-invoice', label: 'Ready to invoice' },
      { code: 'invoiced', label: 'Invoiced' },
      { code: 'finalized', label: 'Finalized' },
    ],
  },
  {
    key: 'patientPaidStatus',
    label: 'Patient Paid Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus,
    group: 'patient',
    defaultCode: null,
    options: PAID_STATUS_OPTIONS,
  },
  {
    key: 'nonInsuranceArStatus',
    label: 'Non-insurance AR Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.nonInsuranceArStatus,
    group: 'nonInsurance',
    defaultCode: null,
    options: [
      { code: 'created', label: 'Created' },
      { code: 'invoiced', label: 'Invoiced' },
      { code: 'finalized', label: 'Finalized' },
    ],
  },
  {
    key: 'nonInsurancePaidStatus',
    label: 'Non-insurance Paid Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.nonInsurancePaidStatus,
    group: 'nonInsurance',
    defaultCode: null,
    options: PAID_STATUS_OPTIONS,
  },
];

export const CLAIM_STATUS_FIELDS_BY_KEY: Record<ClaimStatusFieldKey, ClaimStatusFieldDef> = CLAIM_STATUS_FIELDS.reduce(
  (acc, field) => {
    acc[field.key] = field;
    return acc;
  },
  {} as Record<ClaimStatusFieldKey, ClaimStatusFieldDef>
);

// Flat map of every status field's resolved code for a claim.
export type ClaimStatusValues = Record<ClaimStatusFieldKey, string>;

// Resolve one field's current code from a claim's meta tags, falling back to the field default.
export function getClaimStatusFieldValue(claim: Pick<Claim, 'meta'> | undefined, field: ClaimStatusFieldDef): string {
  const code = claim?.meta?.tag?.find((t) => t.system === field.system)?.code;
  return code ?? field.defaultCode ?? '';
}

// Resolve every status field for a claim into a flat { key: code } map.
export function getClaimStatusValues(claim: Pick<Claim, 'meta'> | undefined): ClaimStatusValues {
  return CLAIM_STATUS_FIELDS.reduce((acc, field) => {
    acc[field.key] = getClaimStatusFieldValue(claim, field);
    return acc;
  }, {} as ClaimStatusValues);
}

// Human-readable label for a field value code (empty/unknown -> '').
export function formatClaimStatusValue(field: ClaimStatusFieldDef, code: string | undefined): string {
  if (!code) return '';
  return field.options.find((o) => o.code === code)?.label ?? code;
}

// Whether `code` is a valid selection for the field. Empty/null (clear back to default) is allowed.
export function isValidClaimStatusValue(field: ClaimStatusFieldDef, code: string | null | undefined): boolean {
  if (code == null || code === '') return true;
  return field.options.some((o) => o.code === code);
}
