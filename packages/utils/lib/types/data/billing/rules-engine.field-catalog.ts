import { SUBSCRIBER_RELATIONSHIPS } from '../../../fhir/constants';
import { isCLIAValid, isNPIValidWithChecksum } from '../../../helpers/helpers';
import { CMS_PLACE_OF_SERVICE_CODE_SET, CMS_PLACE_OF_SERVICE_CODES } from '../../../helpers/rcm/constants';
import { VALUE_SETS } from '../../../ottehr-config/value-sets';
import { isoDateRegex, taxIdRegex, zipRegex } from '../../../validation/regex';
import { AllStates, stateCodeToFullName } from '../../common';
import { PERSON_GENDER_OPTIONS } from './billing.constants';
import { BILLING_INSURANCE_TYPE_OPTIONS } from './billing.types';
import { CLAIM_STATUS_FIELDS } from './claim-status';
import {
  AddServiceLineInput,
  DATE_SOURCE_KIND,
  DateSourceKind,
  DateValue,
  DIAGNOSIS_POINTER_MODES,
  effectiveDiagnosisMode,
  operatorIsMultiValue,
  operatorIsRegex,
  operatorNeedsValue,
  operatorTakesFragment,
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleConditionValue,
  RuleOperator,
  RuleOutcome,
  ServiceLineMatch,
  ServiceLineSetOperation,
} from './rules-engine.schemas';

// Catalog of the logical claim fields rules can condition on and (where settable) set. This is the
// shared contract between the billing app's rule builder (field pickers, operator menus, typed value
// inputs), the engine's readers/writers over the claim model (backend-side in
// packages/zambdas/src/billing/rules-engine/claim-model.ts), and the generated documentation
// (docs/billing-rules-engine.md, rendered by rules-engine.docs.ts). A unit test in zambdas guards
// that every catalog id has a reader and every settable id has a writer; a unit test here guards
// that the committed documentation matches the catalog.

export type RuleFieldGroup =
  | 'claim'
  | 'status'
  | 'patient'
  | 'insurance'
  | 'policyHolder'
  | 'secondaryInsurance'
  | 'secondaryPolicyHolder'
  | 'tertiaryInsurance'
  | 'tertiaryPolicyHolder'
  | 'quaternaryInsurance'
  | 'quaternaryPolicyHolder'
  | 'renderingProvider'
  | 'billingProvider'
  | 'serviceFacility'
  | 'tags';

// Display order of groups in the rule builder's property pickers and in the generated docs.
export const RULE_FIELD_GROUPS: RuleFieldGroup[] = [
  'claim',
  'status',
  'patient',
  'insurance',
  'policyHolder',
  'secondaryInsurance',
  'secondaryPolicyHolder',
  'tertiaryInsurance',
  'tertiaryPolicyHolder',
  'quaternaryInsurance',
  'quaternaryPolicyHolder',
  'renderingProvider',
  'billingProvider',
  'serviceFacility',
  'tags',
];

export const RULE_FIELD_GROUP_LABELS: Record<RuleFieldGroup, string> = {
  claim: 'Claim',
  status: 'Claim status',
  patient: 'Patient',
  insurance: 'Primary insurance',
  policyHolder: 'Primary insurance policy holder',
  secondaryInsurance: 'Secondary insurance',
  secondaryPolicyHolder: 'Secondary insurance policy holder',
  tertiaryInsurance: 'Tertiary insurance',
  tertiaryPolicyHolder: 'Tertiary insurance policy holder',
  quaternaryInsurance: 'Quaternary insurance',
  quaternaryPolicyHolder: 'Quaternary insurance policy holder',
  renderingProvider: 'Rendering provider',
  billingProvider: 'Billing provider',
  serviceFacility: 'Service facility',
  tags: 'Tags',
};

// How a field's comparison value is typed:
// - string: free text
// - number: numeric (amounts, counts); supports gt/gte/lt/lte
// - date: ISO date (YYYY-MM-DD); supports gt/gte/lt/lte (after/before)
// - select: one of the field's `options`
// - list: the claim-side value is a list of codes (diagnosis codes, CPT codes, tags); use
//   contains/notContains to test membership
// - payer: a payer id chosen via the payer search
// - provider: a provider reference resource ("Practitioner/<id>" or "Organization/<id>") chosen
//   from the rendering/billing providers list (the def's providerRole picks which)
// - facility: a service facility reference resource ("Location/<id>") chosen from the service
//   facilities list
export type RuleFieldValueType = 'string' | 'number' | 'date' | 'select' | 'list' | 'payer' | 'provider' | 'facility';

export interface RuleFieldOption {
  value: string;
  label: string;
}

// Value formats a text-typed field can declare. Formats with a `validate` are enforced on
// exact-match condition values and written values (fragment operators like contains/startsWith
// legitimately take partial values and skip them); `tag` and `cpt` carry no sync validator — they
// pick the rule builder's input component (tag dropdown / CPT terminology autocomplete), and tag
// existence is checked server-side at save time.
export type RuleValueFormat = 'npi' | 'clia' | 'zip' | 'taxId' | 'taxonomy' | 'tag' | 'cpt';

export interface RuleValueFormatDef {
  // Sync per-value check; absent for formats that only drive input dispatch (tag, cpt).
  validate?: (value: string) => string | undefined;
  // One-line format hint for the generated docs and UI helper text.
  hint: string;
}

// Messages mirror the billing app's form validation (billing.schemas.ts / the provider and
// service-facility dialogs) so a value rejected here reads the same everywhere.
export const RULE_VALUE_FORMATS: Record<RuleValueFormat, RuleValueFormatDef> = {
  npi: {
    validate: (v) =>
      isNPIValidWithChecksum(v) ? undefined : 'NPI must be a valid 10-digit number with a correct check digit',
    hint: 'a valid 10-digit NPI',
  },
  clia: {
    validate: (v) => (isCLIAValid(v) ? undefined : 'CLIA must match the format NNDNNNNNNN, e.g. 05D1234567'),
    hint: 'format NNDNNNNNNN, e.g. 05D1234567',
  },
  zip: {
    validate: (v) => (zipRegex.test(v) ? undefined : 'ZIP code must be 5 digits, optionally with a 4-digit extension'),
    hint: '5 digits, optionally with a 4-digit extension',
  },
  taxId: {
    validate: (v) => (taxIdRegex.test(v) ? undefined : 'Tax ID / EIN must be exactly 9 digits'),
    hint: 'exactly 9 digits',
  },
  taxonomy: {
    validate: (v) => (v.trim().length === 10 ? undefined : 'Taxonomy code must be exactly 10 characters'),
    hint: 'exactly 10 characters',
  },
  tag: { hint: 'a tag defined on the Tags page' },
  cpt: { hint: 'a CPT/HCPCS code' },
};

export interface RuleFieldDef {
  id: string;
  label: string;
  group: RuleFieldGroup;
  valueType: RuleFieldValueType;
  operators: RuleOperator[];
  // Whether the field can be the target of a setField action.
  settable: boolean;
  // One-line explanation of the field, surfaced in the generated documentation.
  description: string;
  // Valid values for select fields (drives the rule builder dropdown and the docs).
  options?: RuleFieldOption[];
  // Value format for text-typed fields: validation for exact-match/written values plus the rule
  // builder's input dispatch (tag/cpt pickers).
  format?: RuleValueFormat;
  // setField normally treats an empty value as "clear the property"; fields whose writers reject
  // empty (the payer, claim type, service date, plan type) require a value instead.
  requiredOnSet?: boolean;
  // Docs: a short phrase rendered instead of enumerating a huge options list (states, POS codes).
  optionsDocNote?: string;
  // provider-typed fields: which provider list the value is picked from (and, at save time, which
  // role tag the referenced resource must carry).
  providerRole?: 'rendering' | 'billing';
}

const SCALAR_OPS: RuleOperator[] = [
  'eq',
  'neq',
  'in',
  'notIn',
  'contains',
  'notContains',
  'startsWith',
  'notStartsWith',
  'matches',
  'notMatches',
  'exists',
  'notExists',
];
const ENUM_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'matches', 'notMatches', 'exists', 'notExists'];
// Provider/facility reference values ("Practitioner/<id>") are opaque ids — pattern matching them
// is meaningless, so ref-typed fields skip the regex operators.
const REF_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'exists', 'notExists'];
const DATE_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists'];
const NUMBER_OPS: RuleOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists'];
const LIST_OPS: RuleOperator[] = ['contains', 'notContains', 'matches', 'notMatches', 'exists', 'notExists'];
// Counts always exist (an empty claim counts 0), so exists/notExists would be noise.
const COUNT_OPS: RuleOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];

const GENDER_OPTIONS: RuleFieldOption[] = PERSON_GENDER_OPTIONS;

const PLAN_TYPE_OPTIONS: RuleFieldOption[] = VALUE_SETS.insuranceTypeOptions.map((option) => ({
  value: option.candidCode,
  label: `${option.candidCode} - ${option.label}`,
}));

const RELATIONSHIP_OPTIONS: RuleFieldOption[] = SUBSCRIBER_RELATIONSHIPS.map((relationship) => ({
  value: relationship,
  label: relationship,
}));

// The patient-coverage slots (primary / secondary / workers comp on the patient's billing
// accounts) the "Coverage (from patient)" field can name — the same options the coverage screens
// use.
const PATIENT_COVERAGE_SLOT_OPTIONS: RuleFieldOption[] = BILLING_INSURANCE_TYPE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

// The same US state list the billing address forms use (AllStates labels are the bare codes; show
// the full name like AddressFields does).
const STATE_OPTIONS: RuleFieldOption[] = AllStates.map((state) => ({
  value: state.value,
  label: `${state.value} - ${stateCodeToFullName[state.value] ?? state.value}`,
}));
const STATE_OPTIONS_DOC_NOTE = 'any two-letter US state/territory code';

// The CMS place-of-service code set the service facility form picks from.
const POS_OPTIONS: RuleFieldOption[] = CMS_PLACE_OF_SERVICE_CODES.map((pos) => ({
  value: pos.code,
  label: `${pos.code} - ${pos.display}`,
}));
const POS_OPTIONS_DOC_NOTE = 'any CMS place-of-service code';

// Menu options for the addServiceLine action's diagnosis-selection mode (DIAGNOSIS_POINTER_MODES).
const DIAGNOSIS_POINTER_MODE_OPTIONS: RuleFieldOption[] = [
  { value: 'primary', label: "Claim's primary diagnosis" },
  { value: 'all', label: "All of the claim's diagnoses" },
  { value: 'specific', label: 'Specific diagnoses (pointers)' },
];

// One catalog entry per claim status indicator (AR stage, insurance/patient/non-insurance statuses),
// generated from the same CLAIM_STATUS_FIELDS definition the claim screens use.
const STATUS_FIELDS: RuleFieldDef[] = CLAIM_STATUS_FIELDS.map((field) => ({
  id: `status.${field.key}`,
  label: field.label,
  group: 'status',
  valueType: 'select',
  operators: ENUM_OPS,
  settable: true,
  description: `The claim's ${field.label} indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do).`,
  options: field.options.map((option) => ({ value: option.code, label: option.label })),
}));

// A person-shaped resource (patient or policy holder) contributes the same name / birth date /
// gender / address fields; the ids differ only by prefix.
const personFields = (
  prefix: 'patient' | 'policyHolder' | 'secondaryPolicyHolder' | 'tertiaryPolicyHolder' | 'quaternaryPolicyHolder',
  noun: string,
  settable: boolean
): RuleFieldDef[] => {
  const group: RuleFieldGroup = prefix;
  return [
    {
      id: `${prefix}.firstName`,
      label: 'First name',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The ${noun}'s first (given) name.`,
    },
    {
      id: `${prefix}.middleName`,
      label: 'Middle name',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The ${noun}'s middle name (second given name).`,
    },
    {
      id: `${prefix}.lastName`,
      label: 'Last name',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The ${noun}'s last (family) name.`,
    },
    {
      id: `${prefix}.birthDate`,
      label: 'Date of birth',
      group,
      valueType: 'date',
      operators: DATE_OPS,
      settable,
      description: `The ${noun}'s date of birth (YYYY-MM-DD).`,
    },
    {
      id: `${prefix}.gender`,
      label: 'Gender',
      group,
      valueType: 'select',
      operators: ENUM_OPS,
      settable,
      description: `The ${noun}'s administrative gender.`,
      options: GENDER_OPTIONS,
    },
    {
      id: `${prefix}.addressLine1`,
      label: 'Address line 1',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The first street line of the ${noun}'s address.`,
    },
    {
      id: `${prefix}.addressLine2`,
      label: 'Address line 2',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The second street line of the ${noun}'s address.`,
    },
    {
      id: `${prefix}.city`,
      label: 'City',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The city of the ${noun}'s address.`,
    },
    {
      id: `${prefix}.state`,
      label: 'State',
      group,
      valueType: 'select',
      operators: ENUM_OPS,
      settable,
      description: `The state of the ${noun}'s address (two-letter code, e.g. CA).`,
      options: STATE_OPTIONS,
      optionsDocNote: STATE_OPTIONS_DOC_NOTE,
    },
    {
      id: `${prefix}.zip`,
      label: 'ZIP code',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The postal code of the ${noun}'s address.`,
      format: 'zip',
    },
  ];
};

// Coverage resources differ only by prefix.
const coverageFields = (
  prefix: 'insurance' | 'secondaryInsurance' | 'tertiaryInsurance' | 'quaternaryInsurance',
  countingWord: string,
  settable: boolean
): RuleFieldDef[] => {
  const group: RuleFieldGroup = prefix;
  return [
    {
      id: `${prefix}.coverageFromPatient`,
      label: 'Coverage (from patient)',
      group,
      valueType: 'select',
      operators: ENUM_OPS,
      settable,
      description:
        `Which of the patient's coverages the claim uses as its ${countingWord} coverage, looked up on the claim ` +
        "patient's reference record via the patient's billing accounts. Conditions compare against the coverage " +
        `the claim's current ${countingWord} coverage was copied from; setting it creates a fresh working copy of the ` +
        'chosen coverage (and its policy holder) and re-points the claim — later rules read and edit the new ' +
        'copy. If the patient has no active coverage of the chosen type, the rule fails and the claim is held.',
      requiredOnSet: true,
      options: PATIENT_COVERAGE_SLOT_OPTIONS,
    },
    {
      id: `${prefix}.payerId`,
      label: 'Payer ID',
      group,
      valueType: 'payer',
      operators: SCALAR_OPS,
      settable,
      description: `The ${countingWord} payer's ID. Setting it re-points the ${countingWord} coverage's payer.`,
      requiredOnSet: true,
    },
    {
      id: `${prefix}.memberId`,
      label: 'Member ID',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The ${countingWord} coverage's member/subscriber ID.`,
    },
    {
      id: `${prefix}.planType`,
      label: 'Plan type',
      group,
      valueType: 'select',
      operators: ENUM_OPS,
      settable,
      description: `The ${countingWord} coverage's plan type (X12 insurance type code).`,
      requiredOnSet: true,
      options: PLAN_TYPE_OPTIONS,
    },
    {
      id: `${prefix}.relationship`,
      label: 'Relationship to subscriber',
      group,
      valueType: 'select',
      operators: ENUM_OPS,
      // Explicitly false, since this requires also mutating another resource
      settable: false,
      description: `The patient's relationship to the ${countingWord} policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead.`,
      options: RELATIONSHIP_OPTIONS,
    },
  ];
};

// A provider-shaped resource (rendering or billing provider) is a Practitioner or an Organization
// working copy; "last name" doubles as the organization name for organization providers.
const providerFields = (prefix: 'renderingProvider' | 'billingProvider', noun: string): RuleFieldDef[] => {
  const group: RuleFieldGroup = prefix;
  const role = prefix === 'renderingProvider' ? 'rendering' : 'billing';
  return [
    {
      id: `${prefix}.ref`,
      label: 'Provider (from list)',
      group,
      valueType: 'provider',
      operators: REF_OPS,
      settable: true,
      description:
        `Which ${noun} the claim uses, as a reference resource from the ${
          role === 'rendering' ? 'Rendering' : 'Billing'
        } Providers page. Conditions compare against the resource the claim's current ${noun} was copied from; ` +
        `setting it creates a fresh working copy of the chosen provider and re-points the claim — later rules read and edit the new copy.`,
      requiredOnSet: true,
      providerRole: role,
    },
    {
      id: `${prefix}.npi`,
      label: 'NPI',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable: true,
      description: `The ${noun}'s NPI.`,
      format: 'npi',
    },
    {
      id: `${prefix}.firstName`,
      label: 'First name',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable: true,
      description: `The ${noun}'s first name (individual providers only; setting it on an organization provider fails the rule).`,
    },
    {
      id: `${prefix}.lastName`,
      label: 'Last name / organization name',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable: true,
      description: `The ${noun}'s last name, or the organization name for organization providers.`,
    },
    {
      id: `${prefix}.taxonomy`,
      label: 'Taxonomy code',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable: true,
      description: `The ${noun}'s taxonomy code.`,
      format: 'taxonomy',
    },
  ];
};

export const RULE_FIELD_CATALOG: RuleFieldDef[] = [
  // --- Claim ---
  {
    id: 'payerId',
    label: 'Payer ID',
    group: 'claim',
    valueType: 'payer',
    operators: SCALAR_OPS,
    settable: true,
    description: "The primary payer's ID. Setting it re-points the primary coverage's payer and the claim's insurer.",
    requiredOnSet: true,
  },
  {
    id: 'type',
    label: 'Claim type',
    group: 'claim',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: 'The claim type (professional or institutional).',
    requiredOnSet: true,
    options: [
      { value: 'professional', label: 'Professional' },
      { value: 'institutional', label: 'Institutional' },
    ],
  },
  {
    id: 'service',
    label: 'Service category',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description:
      'The service category code on the claim (e.g. urgent-care, workers-comp). Categories are configurable, so the value is free text.',
  },
  {
    id: 'serviceDate',
    label: 'Service date',
    group: 'claim',
    valueType: 'date',
    operators: DATE_OPS,
    settable: true,
    description:
      'The date of service (read from the first service line). Setting it applies the one date to every service line, matching the claim editor.',
    requiredOnSet: true,
  },
  {
    id: 'created',
    label: 'Created date',
    group: 'claim',
    valueType: 'date',
    operators: DATE_OPS,
    settable: false,
    description: 'The date the claim was created. Read-only.',
  },
  {
    id: 'billingType',
    label: 'Billing type',
    group: 'claim',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: false,
    description:
      'Whether the claim bills insurance or the patient. Derived from whether the claim carries a real coverage, so it is read-only (attach or remove a coverage to change it).',
    options: [
      { value: 'Insurance Pay', label: 'Insurance Pay' },
      { value: 'Self Pay', label: 'Self Pay' },
    ],
  },
  {
    id: 'billed',
    label: 'Billed amount',
    group: 'claim',
    valueType: 'number',
    operators: NUMBER_OPS,
    settable: false,
    description:
      'The claim total in dollars. Derived from the sum of service line charges, so it is read-only — it is recomputed when a rule updates line charges or removes lines.',
  },
  {
    id: 'diagnosisCodes',
    label: 'Diagnosis codes',
    group: 'claim',
    valueType: 'list',
    operators: LIST_OPS,
    settable: false,
    description:
      'The list of ICD-10 diagnosis codes on the claim. Use contains / does-not-contain to test for a code; read-only (rules cannot restructure the diagnosis list).',
  },
  {
    id: 'cptCodes',
    label: 'Procedure (CPT) codes',
    group: 'claim',
    valueType: 'list',
    operators: LIST_OPS,
    settable: false,
    description:
      'The list of CPT/HCPCS codes across the service lines. Use contains / does-not-contain to test for a code; change codes with the "Update service lines" action.',
    format: 'cpt',
  },
  {
    id: 'duplicateCptCodes',
    label: 'Duplicate CPT codes',
    group: 'claim',
    valueType: 'list',
    operators: LIST_OPS,
    settable: false,
    description:
      'The CPT/HCPCS codes that appear on more than one service line (empty when every line has a distinct code). "Is present" detects any duplicate billing; "contains" detects duplicates of a specific code.',
    format: 'cpt',
  },
  {
    id: 'placeOfServiceCodes',
    label: 'Place of service codes',
    group: 'claim',
    valueType: 'list',
    operators: LIST_OPS,
    settable: false,
    description:
      'The list of CMS place-of-service codes across the service lines. Change per-line codes with the "Update service lines" action; the service facility place of service applies to future claims.',
  },
  {
    id: 'serviceLineCount',
    label: 'Service line count',
    group: 'claim',
    valueType: 'number',
    operators: COUNT_OPS,
    settable: false,
    description: 'The number of service lines on the claim (0 when there are none).',
  },
  {
    id: 'billType',
    label: 'Bill Type',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: 'Bill Type code on the claim',
  },
  {
    id: 'patientDischargeStatusCode',
    label: 'Patient Discharge Status Code',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: 'Patient Discharge Status Code on the claim',
  },
  {
    id: 'admissionType',
    label: 'Admission Type',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: 'Admission Type code on the claim',
  },
  {
    id: 'admissionSource',
    label: 'Point of Origin / Admission Source',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: 'Point of Origin / Admission Source code on the claim',
  },

  // --- Claim status indicators ---
  ...STATUS_FIELDS,

  // --- Patient ---
  ...personFields('patient', 'patient', true),

  // --- Primary insurance ---
  ...coverageFields('insurance', 'primary', true),

  // --- Primary insurance policy holder (primary coverage subscriber; present when the relationship is not Self) ---
  ...personFields('policyHolder', 'primary policy holder', true),

  // --- Secondary insurance ---
  ...coverageFields('secondaryInsurance', 'secondary', true),

  // --- Secondary insurance policy holder (primary coverage subscriber; present when the relationship is not Self) ---
  ...personFields('secondaryPolicyHolder', 'secondary policy holder', true),

  // --- Tertiary insurance ---
  ...coverageFields('tertiaryInsurance', 'tertiary', true),

  // --- Tertiary insurance policy holder (primary coverage subscriber; present when the relationship is not Self) ---
  ...personFields('tertiaryPolicyHolder', 'tertiary policy holder', true),

  // --- Quaternary insurance ---
  ...coverageFields('quaternaryInsurance', 'quaternary', true),

  // --- Quaternary insurance policy holder (primary coverage subscriber; present when the relationship is not Self) ---
  ...personFields('quaternaryPolicyHolder', 'quaternary policy holder', true),

  // --- Rendering provider ---
  ...providerFields('renderingProvider', 'rendering provider'),

  // --- Billing provider ---
  ...providerFields('billingProvider', 'billing provider'),
  {
    id: 'billingProvider.taxId',
    label: 'Tax ID (TIN)',
    group: 'billingProvider',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The billing provider's tax ID (TIN).",
    format: 'taxId',
  },

  // --- Service facility ---
  {
    id: 'serviceFacility.ref',
    label: 'Facility (from list)',
    group: 'serviceFacility',
    valueType: 'facility',
    operators: REF_OPS,
    settable: true,
    description:
      "Which service facility the claim uses, as a reference resource from the Service Facilities page. Conditions compare against the resource the claim's current facility was copied from; " +
      'setting it creates a fresh working copy of the chosen facility and re-points the claim — later rules read and edit the new copy.',
    requiredOnSet: true,
  },
  {
    id: 'serviceFacility.name',
    label: 'Facility name',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The service facility's name.",
  },
  {
    id: 'serviceFacility.npi',
    label: 'Facility NPI',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The service facility's NPI.",
    format: 'npi',
  },
  {
    id: 'serviceFacility.clia',
    label: 'CLIA number',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The service facility's CLIA number.",
    format: 'clia',
  },
  {
    id: 'serviceFacility.posCode',
    label: 'Place of service code',
    group: 'serviceFacility',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: "The service facility's CMS place-of-service code (e.g. 11 for office, 20 for urgent care).",
    options: POS_OPTIONS,
    optionsDocNote: POS_OPTIONS_DOC_NOTE,
  },
  {
    id: 'serviceFacility.addressLine1',
    label: 'Address line 1',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The first street line of the service facility's address.",
  },
  {
    id: 'serviceFacility.addressLine2',
    label: 'Address line 2',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The second street line of the service facility's address.",
  },
  {
    id: 'serviceFacility.city',
    label: 'City',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The city of the service facility's address.",
  },
  {
    id: 'serviceFacility.state',
    label: 'State',
    group: 'serviceFacility',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: "The state of the service facility's address (two-letter code, e.g. CA).",
    options: STATE_OPTIONS,
    optionsDocNote: STATE_OPTIONS_DOC_NOTE,
  },
  {
    id: 'serviceFacility.zip',
    label: 'ZIP code',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The postal code of the service facility's address.",
    format: 'zip',
  },

  // --- Tags ---
  {
    id: 'tags',
    label: 'Claim tags',
    group: 'tags',
    valueType: 'list',
    operators: LIST_OPS,
    settable: false,
    description:
      'The list of tags on the claim. Use contains / does-not-contain to test for a tag; add tags with the "Apply a tag" action.',
    format: 'tag',
  },
];

export const RULE_FIELD_IDS: string[] = RULE_FIELD_CATALOG.map((f) => f.id);

const CATALOG_BY_ID = new Map(RULE_FIELD_CATALOG.map((f) => [f.id, f]));
export const getRuleFieldDef = (id: string): RuleFieldDef | undefined => CATALOG_BY_ID.get(id);

// ---------------------------------------------------------------------------
// Service line properties.
//
// Service lines are an array, so their properties are not claim fields: they are matched and updated
// per line by the "Update service lines" / "Remove service lines" actions, each of which carries its
// own line predicate. This mini-catalog is the contract for those actions — it drives the rule
// builder's match/set pickers, save-time validation, the engine's per-line readers/writers (paired
// by a unit test like the main catalog), and the generated documentation.
// ---------------------------------------------------------------------------

export type ServiceLineValueType = 'string' | 'number' | 'date' | 'select' | 'list';

export interface ServiceLinePropertyDef {
  id: string;
  label: string;
  valueType: ServiceLineValueType;
  // Operators available when matching lines on this property.
  operators: RuleOperator[];
  // Whether the property can be the target of an updateServiceLines action.
  settable: boolean;
  description: string;
  // Valid values for select-typed properties (drives the rule builder dropdown and the docs).
  options?: RuleFieldOption[];
  format?: RuleValueFormat;
  // Docs: rendered instead of enumerating a huge options list.
  optionsDocNote?: string;
}

export const SERVICE_LINE_PROPERTY_CATALOG: ServiceLinePropertyDef[] = [
  {
    id: 'cptCode',
    label: 'CPT code',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The line's CPT/HCPCS procedure code. Setting it replaces the line's procedure coding.",
    format: 'cpt',
  },
  {
    id: 'modifiers',
    label: 'Modifiers',
    valueType: 'list',
    operators: LIST_OPS,
    settable: true,
    description:
      'The line\'s procedure modifiers. When updating, the operation chooses how the value applies: "set" replaces the whole list (comma-separated; empty clears it), "add" appends one modifier, "remove" drops one.',
  },
  {
    id: 'units',
    label: 'Units',
    valueType: 'number',
    operators: NUMBER_OPS,
    settable: true,
    description: "The line's unit count. Setting it requires a positive number.",
  },
  {
    id: 'charges',
    label: 'Charges',
    valueType: 'number',
    operators: NUMBER_OPS,
    settable: true,
    description:
      "The line's charge amount in dollars. Setting it requires a non-negative number; the claim's billed total is recomputed.",
  },
  {
    id: 'placeOfService',
    label: 'Place of service code',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: "The line's CMS place-of-service code. Setting an empty value clears it.",
    options: POS_OPTIONS,
    optionsDocNote: POS_OPTIONS_DOC_NOTE,
  },
  {
    id: 'serviceDate',
    label: 'Service date',
    valueType: 'date',
    operators: DATE_OPS,
    settable: true,
    description:
      "The line's date of service (YYYY-MM-DD). When updating, the new value can be a literal date or " +
      'derived from the claim (see Service date sources) — matching still compares against a literal date only.',
  },
  {
    id: 'revenueCode',
    label: 'Rev Code',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: 'Revenue code of the procedure.',
  },
];

const SERVICE_LINE_PROPERTIES_BY_ID = new Map(SERVICE_LINE_PROPERTY_CATALOG.map((p) => [p.id, p]));
export const getServiceLinePropertyDef = (id: string): ServiceLinePropertyDef | undefined =>
  SERVICE_LINE_PROPERTIES_BY_ID.get(id);

// ---------------------------------------------------------------------------
// "Add a service line" fields.
//
// The addServiceLine action appends a new line with these fields (ids match AddServiceLineInput's
// keys — a unit test guards the pairing). This list drives the rule builder's add-line form, the
// shared field validation below, and the generated documentation.
// ---------------------------------------------------------------------------

export interface AddServiceLineFieldDef {
  id: keyof AddServiceLineInput;
  label: string;
  valueType: ServiceLineValueType;
  required: boolean;
  // What happens when an optional field is left blank (docs table + UI helper text).
  whenBlank?: string;
  // Valid values (drives an autocomplete in the add-line form and the docs).
  options?: RuleFieldOption[];
  format?: RuleValueFormat;
}

export const ADD_SERVICE_LINE_FIELDS: AddServiceLineFieldDef[] = [
  { id: 'cptCode', label: 'CPT code', valueType: 'string', required: true, format: 'cpt' },
  { id: 'charges', label: 'Charges', valueType: 'number', required: true },
  { id: 'units', label: 'Units', valueType: 'number', required: false, whenBlank: '1' },
  {
    id: 'modifiers',
    label: 'Modifiers (comma-separated)',
    valueType: 'string',
    required: false,
    whenBlank: 'no modifiers',
  },
  {
    id: 'placeOfService',
    label: 'Place of service code',
    valueType: 'string',
    required: false,
    whenBlank: 'none',
    options: POS_OPTIONS,
  },
  {
    id: 'serviceDate',
    label: 'Service date',
    valueType: 'date',
    required: false,
    whenBlank: "inherited from the claim's first service line; the action fails if the claim has no lines",
  },
  {
    id: 'diagnosisMode',
    label: 'Diagnoses',
    valueType: 'select',
    required: false,
    whenBlank: "uses the claim's primary diagnosis",
    options: DIAGNOSIS_POINTER_MODE_OPTIONS,
  },
  {
    id: 'diagnosisPointers',
    label: 'Diagnosis pointers (comma-separated)',
    valueType: 'string',
    // Only shown (and only meaningful) when Diagnoses is 'Specific diagnoses' — see the diagnosisMode
    // field above and effectiveDiagnosisMode() — so whenever it's on screen, leaving it blank isn't a
    // valid "use the default" choice.
    required: true,
  },
  { id: 'revenueCode', label: 'Revenue code', valueType: 'string', required: false },
];

// The date-source options exposed by the addServiceLine/updateServiceLines serviceDate inputs and the
// generated docs. "exact" is not part of DateSourceKind (it's the plain-string form, no tag) — it is
// the UI/docs default.
export const EXACT_DATE_SOURCE = 'exact' as const;
export type DateSourceSelectValue = DateSourceKind | typeof EXACT_DATE_SOURCE;

export const DATE_SOURCE_CATALOG: { value: DateSourceSelectValue; label: string; description: string }[] = [
  { value: 'exact', label: 'Exact date', description: 'A literal date entered on the rule.' },
  {
    value: 'firstServiceLineDate',
    label: "First service line's date",
    description:
      "The claim's first service line's date of service — the same value a blank serviceDate has always " +
      'inherited on "Add a service line".',
  },
];

// A date-typed rule value's problem when it may be a derived source instead of a literal date. A
// literal is accepted as-is here (format is checked by each caller, since blank handling differs
// between addServiceLine and updateServiceLines); a source object must name a known kind.
export function derivedDateValueProblem(value: DateValue): string | undefined {
  if (typeof value !== 'object') return undefined;
  const known: string[] = Object.values(DATE_SOURCE_KIND);
  return known.includes(value.source) ? undefined : 'Unknown date source';
}

// One add-line field's format problem, or undefined when the value is acceptable. Shared by the rule
// builder (per-field validation messages) and save-time validation; claim-dependent checks (e.g. a
// pointer beyond the claim's diagnosis count) happen at apply time in the engine.
//
// `line` carries the sibling diagnosisMode so diagnosisPointers can be validated as required exactly
// when the mode makes it meaningful ('specific') — the rest of the fields don't need it.
export function addServiceLineFieldProblem(
  fieldId: AddServiceLineFieldDef['id'],
  value: string | DateValue | undefined,
  line?: Pick<AddServiceLineInput, 'diagnosisMode'>
): string | undefined {
  if (fieldId === 'serviceDate') {
    if (value == null || value === '') return undefined; // inherited from the claim's first service line
    if (typeof value === 'object') return derivedDateValueProblem(value);
    return isoDateRegex.test(value.trim()) ? undefined : 'Service date must be an ISO date (YYYY-MM-DD)';
  }
  const trimmed = (value as string | undefined)?.trim() ?? '';
  switch (fieldId) {
    case 'cptCode':
      return trimmed ? undefined : 'CPT code is required';
    case 'charges': {
      if (!trimmed) return 'Charges are required';
      const charges = Number(trimmed);
      return Number.isFinite(charges) && charges >= 0 ? undefined : 'Charges must be a non-negative number';
    }
    case 'units': {
      if (!trimmed) return undefined;
      const units = Number(trimmed);
      return Number.isFinite(units) && units > 0 ? undefined : 'Units must be a positive number';
    }
    case 'diagnosisMode':
      if (!trimmed) return undefined;
      return (DIAGNOSIS_POINTER_MODES as readonly string[]).includes(trimmed) ? undefined : 'Unknown diagnosis mode';
    case 'diagnosisPointers': {
      if (!trimmed) {
        return effectiveDiagnosisMode({ diagnosisMode: line?.diagnosisMode, diagnosisPointers: trimmed }) === 'specific'
          ? "Diagnosis pointers are required when Diagnoses is 'Specific diagnoses'"
          : undefined;
      }
      const pointers = trimmed.split(',').map((part) => Number(part.trim()));
      return pointers.every((pointer) => Number.isInteger(pointer) && pointer >= 1)
        ? undefined
        : 'Diagnosis pointers must be comma-separated numbers (1 = first diagnosis)';
    }
    case 'placeOfService':
      if (!trimmed) return undefined;
      return CMS_PLACE_OF_SERVICE_CODE_SET.has(trimmed) ? undefined : 'Unknown place of service code';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Per-value validation, shared by the rule builder (react-hook-form rules on each value input) and
// save-time validation (validateRuleFieldReferences below) so client and server stay in lockstep —
// the same double duty addServiceLineFieldProblem performs for the add-line form. The engine's
// writers enforce the same checks at apply time as the last line of defense.
// ---------------------------------------------------------------------------

const DATE_VALUE_PROBLEM = 'Must be an ISO date (YYYY-MM-DD)';
const NUMBER_VALUE_PROBLEM = 'Must be a number';
const VALUE_REQUIRED_PROBLEM = 'Value is required';
const SINGLE_VALUE_PROBLEM = 'This operator compares a single value, not a list';

// Regex-operator values are patterns, not literals: instead of the strict format/options checks they
// must compile (and stay small — a hard length cap bounds pathological patterns). The evaluator
// still compiles defensively at run time, but this is the gate that keeps bad patterns out.
export const MAX_REGEX_PATTERN_LENGTH = 500;

export function regexPatternProblem(pattern: string): string | undefined {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return `Pattern must be at most ${MAX_REGEX_PATTERN_LENGTH} characters`;
  }
  try {
    new RegExp(pattern);
    return undefined;
  } catch {
    return 'Must be a valid regular expression';
  }
}

// FHIR resource ids are 1-64 chars of letters, digits, '-' and '.'.
const PROVIDER_REF_REGEX = /^(Practitioner|Organization)\/[A-Za-z0-9.-]{1,64}$/;
const FACILITY_REF_REGEX = /^Location\/[A-Za-z0-9.-]{1,64}$/;

// Strict single-value check against a def's options / valueType / format. Used for exact-match
// condition values and written values; fragment operators bypass it (a partial NPI is legitimate).
const strictValueProblem = (
  def: Pick<RuleFieldDef, 'valueType' | 'options' | 'format'>,
  value: string
): string | undefined => {
  if (def.options && !def.options.some((option) => option.value === value)) {
    return 'Value must be one of the listed options';
  }
  if (def.valueType === 'date' && !isoDateRegex.test(value)) return DATE_VALUE_PROBLEM;
  if (def.valueType === 'number' && !Number.isFinite(Number(value))) return NUMBER_VALUE_PROBLEM;
  if (def.valueType === 'provider' && !PROVIDER_REF_REGEX.test(value)) {
    return 'Must be a provider reference (Practitioner/<id> or Organization/<id>)';
  }
  if (def.valueType === 'facility' && !FACILITY_REF_REGEX.test(value)) {
    return 'Must be a facility reference (Location/<id>)';
  }
  if (def.format) return RULE_VALUE_FORMATS[def.format].validate?.(value);
  return undefined;
};

// One condition value's problem, or undefined. Operator-aware: exists/notExists take no value;
// every other operator requires a non-empty value (in/notIn: a non-empty list of non-empty values);
// regex operators require a compilable pattern; fragment operators skip the strict checks;
// exact-match operators validate each value in full.
export function ruleConditionValueProblem(
  def: Pick<RuleFieldDef, 'valueType' | 'options' | 'format'>,
  operator: RuleOperator,
  value: RuleConditionValue | undefined
): string | undefined {
  if (!operatorNeedsValue(operator)) return undefined;
  // A list value under a single-value operator would be silently truncated to its first entry by
  // the evaluator (a leftover from switching "is one of" to "equals") — reject it instead.
  if (Array.isArray(value) && !operatorIsMultiValue(operator)) return SINGLE_VALUE_PROBLEM;
  const values = (Array.isArray(value) ? value : [value ?? '']).map((v) => v.trim());
  if (values.length === 0 || values.some((v) => v === '')) return VALUE_REQUIRED_PROBLEM;
  // Validate the raw (untrimmed) scalar: whitespace can be a meaningful part of a pattern.
  if (operatorIsRegex(operator)) return regexPatternProblem(typeof value === 'string' ? value : '');
  if (operatorTakesFragment(operator)) return undefined;
  for (const v of values) {
    const problem = strictValueProblem(def, v);
    if (problem) return problem;
  }
  return undefined;
}

// A setField value's problem, or undefined. Empty means "clear the property" and is allowed unless
// the field's writer requires a value (requiredOnSet); non-empty values are validated in full.
export function setFieldValueProblem(
  def: Pick<RuleFieldDef, 'valueType' | 'options' | 'format' | 'requiredOnSet'>,
  value: string | null | undefined
): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return def.requiredOnSet ? VALUE_REQUIRED_PROBLEM : undefined;
  return strictValueProblem(def, trimmed);
}

// A service-line match value's problem — same operator-aware logic over a line property def.
export function serviceLineMatchValueProblem(
  def: Pick<ServiceLinePropertyDef, 'valueType' | 'options' | 'format'>,
  operator: RuleOperator,
  value: RuleConditionValue | undefined
): string | undefined {
  if (!operatorNeedsValue(operator)) return undefined;
  if (Array.isArray(value) && !operatorIsMultiValue(operator)) return SINGLE_VALUE_PROBLEM;
  const values = (Array.isArray(value) ? value : [value ?? '']).map((v) => v.trim());
  if (values.length === 0 || values.some((v) => v === '')) return VALUE_REQUIRED_PROBLEM;
  if (operatorIsRegex(operator)) return regexPatternProblem(typeof value === 'string' ? value : '');
  if (operatorTakesFragment(operator)) return undefined;
  // List-valued line properties (modifiers) compare a single entry; no strict format applies.
  if (def.valueType === 'list') return undefined;
  for (const v of values) {
    const problem = strictValueProblem(def, v);
    if (problem) return problem;
  }
  return undefined;
}

// An updateServiceLines set value's problem — mirrors the line writers exactly: units require a
// positive number, charges a non-negative number, cptCode/serviceDate a value; placeOfService and
// modifiers-with-"set" allow empty (clears). A derived date-source object is only valid when the
// target property is date-typed — there is no blank-fallback on update, unlike addServiceLine.
export function serviceLineSetValueProblem(
  def: Pick<ServiceLinePropertyDef, 'id' | 'valueType' | 'options' | 'format'>,
  operation: ServiceLineSetOperation | undefined,
  value: DateValue | null | undefined
): string | undefined {
  if (typeof value === 'object' && value != null) {
    if (def.valueType !== 'date') return 'This property does not accept a derived date value';
    return derivedDateValueProblem(value);
  }
  const trimmed = value?.trim() ?? '';
  if (def.valueType === 'list') {
    // modifiers: add/remove need the one modifier; "set" replaces the list (empty clears).
    const resolved = operation ?? 'set';
    if (resolved !== 'set' && trimmed === '') return VALUE_REQUIRED_PROBLEM;
    return undefined;
  }
  if (trimmed === '') {
    // Only placeOfService is clearable among the scalar line properties (matches the writers).
    return def.id === 'placeOfService' ? undefined : VALUE_REQUIRED_PROBLEM;
  }
  if (def.id === 'units') {
    const units = Number(trimmed);
    return Number.isFinite(units) && units > 0 ? undefined : 'Units must be a positive number';
  }
  if (def.id === 'charges') {
    const charges = Number(trimmed);
    return Number.isFinite(charges) && charges >= 0 ? undefined : 'Charges must be a non-negative number';
  }
  return strictValueProblem(def, trimmed);
}

// Walk every action in a rule's conditional tree (branch outcomes, nested conditionals, and the
// otherwise outcome) in tree order — the shared traversal under the collectors below.
function forEachRuleAction(rule: { conditional: RuleConditional }, visit: (action: RuleAction) => void): void {
  const visitOutcome = (outcome: RuleOutcome): void => {
    if (outcome.type === 'actions') outcome.actions.forEach(visit);
    if (outcome.type === 'conditional') visitConditional(outcome.conditional);
  };
  const visitConditional = (conditional: RuleConditional): void => {
    for (const branch of conditional.branches) visitOutcome(branch.outcome);
    if (conditional.otherwise) visitOutcome(conditional.otherwise);
  };
  visitConditional(rule.conditional);
}

// The tag names a rule's applyTag actions reference (deduped, in tree order) — save-billing-rules
// checks them against the tags feature.
export function collectApplyTagNames(rule: { conditional: RuleConditional }): string[] {
  const names: string[] = [];
  forEachRuleAction(rule, (action) => {
    if (action.type === 'applyTag' && !names.includes(action.tag)) names.push(action.tag);
  });
  return names;
}

// Whether any action in the rule applies charge master prices — the engine prefetches the candidate
// charge masters for a run only when an enabled rule needs them.
export function ruleUsesChargeMasterPrices(rule: { conditional: RuleConditional }): boolean {
  let uses = false;
  forEachRuleAction(rule, (action) => {
    if (action.type === 'applyChargeMasterPrices') uses = true;
  });
  return uses;
}

// Walk every condition in a rule's conditional tree (branch conditions, nested groups, and
// conditionals reached through outcomes) in tree order — the condition-side counterpart of
// forEachRuleAction.
function forEachRuleCondition(rule: { conditional: RuleConditional }, visit: (condition: RuleCondition) => void): void {
  const visitCondition = (condition: RuleCondition): void => {
    visit(condition);
    if (condition.type === 'group') condition.conditions.forEach(visitCondition);
  };
  const visitOutcome = (outcome: RuleOutcome): void => {
    if (outcome.type === 'conditional') visitConditional(outcome.conditional);
  };
  const visitConditional = (conditional: RuleConditional): void => {
    for (const branch of conditional.branches) {
      visitCondition(branch.condition);
      visitOutcome(branch.outcome);
    }
    if (conditional.otherwise) visitOutcome(conditional.otherwise);
  };
  visitConditional(rule.conditional);
}

export const PATIENT_COVERAGE_FIELD_ID = 'insurance.coverageFromPatient';

// Whether the rule references the "Coverage (from patient)" field in any condition or setField
// action. The field's reader and writer both need the reference patient's coverage context, which
// the engine prefetches only for rule sets that use the field (like the charge-master prefetch).
export function ruleReferencesPatientCoverage(rule: { conditional: RuleConditional }): boolean {
  let references = false;
  forEachRuleCondition(rule, (condition) => {
    if (condition.type === 'field' && condition.field === PATIENT_COVERAGE_FIELD_ID) references = true;
  });
  forEachRuleAction(rule, (action) => {
    if (action.type === 'setField' && action.field === PATIENT_COVERAGE_FIELD_ID) references = true;
  });
  return references;
}

// The provider/facility reference values a rule's setField actions assign (deduped, in tree
// order) — save-billing-rules verifies each referenced resource exists, and the engine prefetches
// the originals so the (synchronous) writers can copy them.
export interface SetResourceRef {
  field: string;
  ref: string;
}

export function collectSetResourceRefs(rule: { conditional: RuleConditional }): SetResourceRef[] {
  const refs: SetResourceRef[] = [];
  const seen = new Set<string>();
  forEachRuleAction(rule, (action) => {
    if (action.type !== 'setField') return;
    const def = CATALOG_BY_ID.get(action.field);
    if (def?.valueType !== 'provider' && def?.valueType !== 'facility') return;
    const ref = action.value?.trim();
    const key = `${action.field}|${ref}`;
    if (!ref || seen.has(key)) return;
    seen.add(key);
    refs.push({ field: action.field, ref });
  });
  return refs;
}

// ---------------------------------------------------------------------------
// Save-time validation: walk a rule's conditional tree and report references to unknown properties
// in conditions and unknown/read-only properties in setField actions. The engine also fails safe at
// runtime (an unknown reader evaluates to "missing", an unknown/read-only writer holds the claim),
// but rejecting bad references at save time surfaces typos immediately — especially for rules
// created through the API rather than the rule builder.
// ---------------------------------------------------------------------------

export function validateRuleFieldReferences(rule: { name: string; conditional: RuleConditional }): string[] {
  const problems: string[] = [];

  const visitCondition = (condition: RuleCondition): void => {
    if (condition.type === 'field') {
      const def = CATALOG_BY_ID.get(condition.field);
      if (!def) {
        problems.push(`rule "${rule.name}" has a condition on unknown property "${condition.field}"`);
      } else if (!def.operators.includes(condition.operator)) {
        problems.push(
          `rule "${rule.name}" has a condition on "${condition.field}" with unsupported operator "${condition.operator}"`
        );
      } else {
        const problem = ruleConditionValueProblem(def, condition.operator, condition.value);
        if (problem) {
          problems.push(
            `rule "${rule.name}" has a condition on "${condition.field}" with an invalid value: ${problem}`
          );
        }
      }
    }
    if (condition.type === 'group') condition.conditions.forEach(visitCondition);
  };

  const visitServiceLineMatch = (match: ServiceLineMatch): void => {
    if (match.type !== 'field') return;
    const def = SERVICE_LINE_PROPERTIES_BY_ID.get(match.property);
    if (!def) {
      problems.push(`rule "${rule.name}" matches service lines on unknown property "${match.property}"`);
    } else if (!def.operators.includes(match.operator)) {
      problems.push(
        `rule "${rule.name}" matches service lines on "${match.property}" with unsupported operator "${match.operator}"`
      );
    } else {
      const problem = serviceLineMatchValueProblem(def, match.operator, match.value);
      if (problem) {
        problems.push(
          `rule "${rule.name}" matches service lines on "${match.property}" with an invalid value: ${problem}`
        );
      }
    }
  };

  const visitAction = (action: RuleAction): void => {
    if (action.type === 'setField') {
      const def = CATALOG_BY_ID.get(action.field);
      if (!def) {
        problems.push(`rule "${rule.name}" sets unknown property "${action.field}"`);
      } else if (!def.settable) {
        problems.push(`rule "${rule.name}" sets read-only property "${action.field}"`);
      } else {
        const problem = setFieldValueProblem(def, action.value);
        if (problem) problems.push(`rule "${rule.name}" sets "${action.field}" to an invalid value: ${problem}`);
      }
      return;
    }
    if (action.type === 'removeServiceLines' || action.type === 'applyChargeMasterPrices') {
      visitServiceLineMatch(action.match);
      return;
    }
    if (action.type === 'addServiceLine') {
      for (const field of ADD_SERVICE_LINE_FIELDS) {
        const problem = addServiceLineFieldProblem(field.id, action.line[field.id], action.line);
        if (problem) problems.push(`rule "${rule.name}" adds a service line: ${problem}`);
      }
      return;
    }
    if (action.type === 'updateServiceLines') {
      visitServiceLineMatch(action.match);
      const def = SERVICE_LINE_PROPERTIES_BY_ID.get(action.set.property);
      if (!def) {
        problems.push(`rule "${rule.name}" updates unknown service line property "${action.set.property}"`);
      } else if (!def.settable) {
        problems.push(`rule "${rule.name}" updates read-only service line property "${action.set.property}"`);
      } else if (action.set.operation && action.set.operation !== 'set' && def.valueType !== 'list') {
        problems.push(
          `rule "${rule.name}" uses operation "${action.set.operation}" on non-list service line property "${action.set.property}"`
        );
      } else {
        const problem = serviceLineSetValueProblem(def, action.set.operation, action.set.value);
        if (problem) {
          problems.push(
            `rule "${rule.name}" updates service line property "${action.set.property}" with an invalid value: ${problem}`
          );
        }
      }
    }
  };

  const visitOutcome = (outcome: RuleOutcome): void => {
    if (outcome.type === 'actions') outcome.actions.forEach(visitAction);
    if (outcome.type === 'conditional') visitConditional(outcome.conditional);
  };

  const visitConditional = (conditional: RuleConditional): void => {
    for (const branch of conditional.branches) {
      visitCondition(branch.condition);
      visitOutcome(branch.outcome);
    }
    if (conditional.otherwise) visitOutcome(conditional.otherwise);
  };

  visitConditional(rule.conditional);
  return problems;
}
