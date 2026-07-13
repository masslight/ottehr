import { RuleOperator } from './rules-engine.schemas';

// Catalog of the logical claim fields rules can condition on and (where settable) set. This is the
// shared contract between the billing app's rule builder (field pickers, operator menus, typed value
// inputs) and the engine's readers/writers over the claim model, which live backend-side in
// packages/zambdas/src/billing/rules-engine/claim-model.ts. A unit test there guards that every
// catalog id has a reader and every settable id has a writer.

export type RuleFieldGroup = 'claim' | 'patient' | 'serviceFacility' | 'renderingProvider' | 'tags';
export type RuleFieldValueType = 'string' | 'date' | 'gender' | 'tags' | 'payer';

export interface RuleFieldDef {
  id: string;
  label: string;
  group: RuleFieldGroup;
  valueType: RuleFieldValueType;
  operators: RuleOperator[];
  // Whether the field can be the target of a setField action.
  settable: boolean;
}

const SCALAR_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'contains', 'notContains', 'exists', 'notExists'];
const ENUM_OPS: RuleOperator[] = ['eq', 'neq', 'in', 'notIn', 'exists', 'notExists'];
const TAG_OPS: RuleOperator[] = ['contains', 'notContains', 'exists', 'notExists'];

export const RULE_FIELD_CATALOG: RuleFieldDef[] = [
  { id: 'payerId', label: 'Payer ID', group: 'claim', valueType: 'payer', operators: SCALAR_OPS, settable: true },
  {
    id: 'patient.firstName',
    label: 'Patient first name',
    group: 'patient',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'patient.lastName',
    label: 'Patient last name',
    group: 'patient',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'patient.birthDate',
    label: 'Patient date of birth',
    group: 'patient',
    valueType: 'date',
    operators: ENUM_OPS,
    settable: true,
  },
  {
    id: 'patient.gender',
    label: 'Patient gender',
    group: 'patient',
    valueType: 'gender',
    operators: ENUM_OPS,
    settable: true,
  },
  {
    id: 'serviceFacility.name',
    label: 'Service facility name',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'serviceFacility.npi',
    label: 'Service facility NPI',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'serviceFacility.state',
    label: 'Service facility state',
    group: 'serviceFacility',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'renderingProvider.npi',
    label: 'Rendering provider NPI',
    group: 'renderingProvider',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  {
    id: 'renderingProvider.lastName',
    label: 'Rendering provider last name',
    group: 'renderingProvider',
    valueType: 'string',
    operators: SCALAR_OPS,
    settable: true,
  },
  { id: 'tags', label: 'Claim tags', group: 'tags', valueType: 'tags', operators: TAG_OPS, settable: false },
];

export const RULE_FIELD_IDS: string[] = RULE_FIELD_CATALOG.map((f) => f.id);
export const getRuleFieldDef = (id: string): RuleFieldDef | undefined => RULE_FIELD_CATALOG.find((f) => f.id === id);
