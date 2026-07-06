import { Claim } from 'fhir/r4b';

/**
 * Billing claim status indicators.
 *
 * Each status field is stored as a single `meta.tag` on the FHIR Claim resource under its own
 * `system`; the tag's `code` holds the current value.
 */

// Ordered list of field keys. Doubles as the source of truth for value-bearing types and the
// setter zambda's `field` enum.
export const CLAIM_STATUS_FIELD_KEYS = [
  'arStage',
  'insuranceArStatus',
  'insurancePaidStatus',
  'adjudicationStatus',
  'patientArStatus',
  'patientPaidStatus',
  'nonInsuranceArStatus',
  'nonInsurancePaidStatus',
] as const;

export type ClaimStatusFieldKey = (typeof CLAIM_STATUS_FIELD_KEYS)[number];

const CLAIM_STATUS_CODE_SYSTEM_BASE = 'https://fhir.ottehr.com/billing/CodeSystem';

export const CLAIM_STATUS_TAG_SYSTEMS: Record<ClaimStatusFieldKey, string> = {
  arStage: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/ar-stage`,
  insuranceArStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/insurance-ar-status`,
  insurancePaidStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/insurance-paid-status`,
  adjudicationStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/adjudication-status`,
  patientArStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/patient-ar-status`,
  patientPaidStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/patient-paid-status`,
  nonInsuranceArStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/non-insurance-ar-status`,
  nonInsurancePaidStatus: `${CLAIM_STATUS_CODE_SYSTEM_BASE}/non-insurance-paid-status`,
};

export const AR_STAGE = {
  insurancePayer: 'insurance-payer-ar',
  patient: 'patient-ar',
  nonInsurancePayer: 'non-insurance-payer-ar',
} as const;

export type ArStageCode = (typeof AR_STAGE)[keyof typeof AR_STAGE];

// Conceptual groupings of the status fields. AR Stage stands on its own as the top-level field, so
// it has no group. The remaining fields cluster by which receivable they track.
export type ClaimStatusGroupKey = 'insurance' | 'patient' | 'nonInsurance';

export interface ClaimStatusGroupDef {
  key: ClaimStatusGroupKey;
  label: string;
  // The AR Stage value that makes this group the "active" one (its statuses are the ones in play).
  arStageCode: ArStageCode;
  // The field tracking progress through this AR stage.
  primaryFieldKey: ClaimStatusFieldKey;
}

export const CLAIM_STATUS_GROUPS: ClaimStatusGroupDef[] = [
  { key: 'insurance', label: 'Insurance', arStageCode: AR_STAGE.insurancePayer, primaryFieldKey: 'insuranceArStatus' },
  { key: 'patient', label: 'Patient', arStageCode: AR_STAGE.patient, primaryFieldKey: 'patientArStatus' },
  {
    key: 'nonInsurance',
    label: 'Non-insurance',
    arStageCode: AR_STAGE.nonInsurancePayer,
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
      { code: AR_STAGE.insurancePayer, label: 'Insurance Payer AR' },
      { code: AR_STAGE.patient, label: 'Patient AR' },
      { code: AR_STAGE.nonInsurancePayer, label: 'Non-insurance Payer AR' },
    ],
  },
  {
    key: 'insuranceArStatus',
    label: 'Insurance AR Status',
    system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
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

// Resolve one field's current code from a claim's meta tags. An absent tag is the valid "None" state
// for the field (most claims won't carry every tag), so it resolves to the field default — or '' when
// there is none — rather than being treated as an error.
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

// A fully-keyed status map with every field at None (''), e.g. the initial state for a create form.
export function emptyClaimStatusValues(): ClaimStatusValues {
  return CLAIM_STATUS_FIELD_KEYS.reduce((acc, key) => {
    acc[key] = '';
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

// Apply the "entering an AR stage initializes that stage's progress status" rule to a set of status
// values (used at claim creation and when picking an AR Stage). No-op if the progress status is set.
export function withArStageInitialization(values: Partial<ClaimStatusValues>): Partial<ClaimStatusValues> {
  const group = getActiveStatusGroup(values.arStage);
  if (!group || values[group.primaryFieldKey]) return values;
  const firstValue = CLAIM_STATUS_FIELDS_BY_KEY[group.primaryFieldKey].options[0]?.code;
  if (!firstValue) return values;
  return { ...values, [group.primaryFieldKey]: firstValue };
}

// Convert a set of status values into Claim meta.tag Codings, skipping None/empty and invalid values.
export function claimStatusValuesToTags(values: Partial<ClaimStatusValues>): { system: string; code: string }[] {
  const tags: { system: string; code: string }[] = [];
  for (const field of CLAIM_STATUS_FIELDS) {
    const code = values[field.key];
    if (code && isValidClaimStatusValue(field, code)) {
      tags.push({ system: field.system, code });
    }
  }
  return tags;
}
