import { SUBSCRIBER_RELATIONSHIPS } from '../../../fhir/constants';
import { VALUE_SETS } from '../../../ottehr-config/value-sets';
import { CLAIM_STATUS_FIELDS } from './claim-status';
import {
  RuleAction,
  RuleCondition,
  RuleConditional,
  RuleOperator,
  RuleOutcome,
  ServiceLineMatch,
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
  policyHolder: 'Policy holder',
  secondaryInsurance: 'Secondary insurance',
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
export type RuleFieldValueType = 'string' | 'number' | 'date' | 'select' | 'list' | 'payer';

export interface RuleFieldOption {
  value: string;
  label: string;
}

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
}

const SCALAR_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'contains', 'notContains', 'exists', 'notExists'];
const ENUM_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'exists', 'notExists'];
const DATE_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists'];
const NUMBER_OPS: RuleOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists'];
const LIST_OPS: RuleOperator[] = ['contains', 'notContains', 'exists', 'notExists'];
// Counts always exist (an empty claim counts 0), so exists/notExists would be noise.
const COUNT_OPS: RuleOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];

const GENDER_OPTIONS: RuleFieldOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

const COVERAGE_STATUS_OPTIONS: RuleFieldOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'draft', label: 'Draft' },
  { value: 'entered-in-error', label: 'Entered in error' },
];

const PLAN_TYPE_OPTIONS: RuleFieldOption[] = VALUE_SETS.insuranceTypeOptions.map((option) => ({
  value: option.candidCode,
  label: `${option.candidCode} - ${option.label}`,
}));

const RELATIONSHIP_OPTIONS: RuleFieldOption[] = SUBSCRIBER_RELATIONSHIPS.map((relationship) => ({
  value: relationship,
  label: relationship,
}));

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
const personFields = (prefix: 'patient' | 'policyHolder', noun: string, settable: boolean): RuleFieldDef[] => {
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
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The state of the ${noun}'s address (two-letter code, e.g. CA).`,
    },
    {
      id: `${prefix}.zip`,
      label: 'ZIP code',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable,
      description: `The postal code of the ${noun}'s address.`,
    },
  ];
};

// A provider-shaped resource (rendering or billing provider) is a Practitioner or an Organization
// working copy; "last name" doubles as the organization name for organization providers.
const providerFields = (prefix: 'renderingProvider' | 'billingProvider', noun: string): RuleFieldDef[] => {
  const group: RuleFieldGroup = prefix;
  return [
    {
      id: `${prefix}.npi`,
      label: 'NPI',
      group,
      valueType: 'string',
      operators: SCALAR_OPS,
      settable: true,
      description: `The ${noun}'s NPI.`,
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
  },
  {
    id: 'type',
    label: 'Claim type',
    group: 'claim',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: 'The claim type (professional or institutional).',
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
    id: 'billableStatus',
    label: 'Billable status',
    group: 'claim',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: false,
    description:
      "Whether the claim is billable. Derived from the claim's lifecycle status (entered-in-error claims are not billable), so it is read-only.",
    options: [
      { value: 'Billable', label: 'Billable' },
      { value: 'Not Billable', label: 'Not Billable' },
    ],
  },
  {
    id: 'encounterId',
    label: 'Encounter ID',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: false,
    description: 'The clinical encounter this claim was generated from. Read-only.',
  },
  {
    id: 'appointmentId',
    label: 'Appointment ID',
    group: 'claim',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: false,
    description: 'The clinical appointment this claim was generated from. Read-only.',
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

  // --- Claim status indicators ---
  ...STATUS_FIELDS,

  // --- Patient ---
  ...personFields('patient', 'patient', true),

  // --- Primary insurance ---
  {
    id: 'insurance.memberId',
    label: 'Member ID',
    group: 'insurance',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The primary coverage's member/subscriber ID.",
  },
  {
    id: 'insurance.status',
    label: 'Coverage status',
    group: 'insurance',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: "The primary coverage's status.",
    options: COVERAGE_STATUS_OPTIONS,
  },
  {
    id: 'insurance.planType',
    label: 'Plan type',
    group: 'insurance',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: true,
    description: "The primary coverage's plan type (X12 insurance type code).",
    options: PLAN_TYPE_OPTIONS,
  },
  {
    id: 'insurance.relationship',
    label: 'Relationship to subscriber',
    group: 'insurance',
    valueType: 'select',
    operators: ENUM_OPS,
    settable: false,
    description:
      "The patient's relationship to the primary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead.",
    options: RELATIONSHIP_OPTIONS,
  },

  // --- Policy holder (primary coverage subscriber; present when the relationship is not Self) ---
  ...personFields('policyHolder', 'primary policy holder', true),

  // --- Secondary insurance ---
  {
    id: 'secondaryInsurance.payerId',
    label: 'Secondary payer ID',
    group: 'secondaryInsurance',
    valueType: 'payer',
    operators: SCALAR_OPS,
    settable: true,
    description: "The secondary payer's ID. Setting it re-points the secondary coverage's payer.",
  },
  {
    id: 'secondaryInsurance.memberId',
    label: 'Secondary member ID',
    group: 'secondaryInsurance',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The secondary coverage's member/subscriber ID.",
  },

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
  },

  // --- Service facility ---
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
  },
  {
    id: 'serviceFacility.clia',
    label: 'CLIA number',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The service facility's CLIA number.",
  },
  {
    id: 'serviceFacility.posCode',
    label: 'Place of service code',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The service facility's CMS place-of-service code (e.g. 11 for office, 20 for urgent care).",
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
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The state of the service facility's address (two-letter code, e.g. CA).",
  },
  {
    id: 'serviceFacility.zip',
    label: 'ZIP code',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The postal code of the service facility's address.",
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

export type ServiceLineValueType = 'string' | 'number' | 'date' | 'list';

export interface ServiceLinePropertyDef {
  id: string;
  label: string;
  valueType: ServiceLineValueType;
  // Operators available when matching lines on this property.
  operators: RuleOperator[];
  // Whether the property can be the target of an updateServiceLines action.
  settable: boolean;
  description: string;
}

export const SERVICE_LINE_PROPERTY_CATALOG: ServiceLinePropertyDef[] = [
  {
    id: 'cptCode',
    label: 'CPT code',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The line's CPT/HCPCS procedure code. Setting it replaces the line's procedure coding.",
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
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
    description: "The line's CMS place-of-service code. Setting an empty value clears it.",
  },
  {
    id: 'serviceDate',
    label: 'Service date',
    valueType: 'date',
    operators: DATE_OPS,
    settable: true,
    description: "The line's date of service (YYYY-MM-DD).",
  },
];

const SERVICE_LINE_PROPERTIES_BY_ID = new Map(SERVICE_LINE_PROPERTY_CATALOG.map((p) => [p.id, p]));
export const getServiceLinePropertyDef = (id: string): ServiceLinePropertyDef | undefined =>
  SERVICE_LINE_PROPERTIES_BY_ID.get(id);

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
    if (condition.type === 'field' && !CATALOG_BY_ID.has(condition.field)) {
      problems.push(`rule "${rule.name}" has a condition on unknown property "${condition.field}"`);
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
    }
  };

  const visitAction = (action: RuleAction): void => {
    if (action.type === 'setField') {
      const def = CATALOG_BY_ID.get(action.field);
      if (!def) {
        problems.push(`rule "${rule.name}" sets unknown property "${action.field}"`);
      } else if (!def.settable) {
        problems.push(`rule "${rule.name}" sets read-only property "${action.field}"`);
      }
      return;
    }
    if (action.type === 'removeServiceLines') {
      visitServiceLineMatch(action.match);
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
