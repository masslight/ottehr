import { Claim, Coverage, Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import { getNPI, setNpi } from '../../../fhir/helpers';
import { extractPayerIdFromUrl, getPayerUrl } from '../../../helpers/helpers';
import { CLAIM_TAG_SYSTEM } from './billing.constants';
import { RuleOperator } from './rules-engine.schemas';

// Maps each logical rule field id to a reader and, where settable, a writer over the assembled
// RulesEngineClaimModel. The catalog metadata also drives the rule builder's field pickers.

export interface RulesEngineClaimModel {
  claim: Claim;
  patient?: Patient;
  // Working-copy coverages ordered so that coverages[0] is the primary (focal) coverage.
  coverages: Coverage[];
  renderingProvider?: Practitioner | Organization;
  serviceFacility?: Location;
}

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

// --- shared accessors ---

const primaryCoverage = (m: RulesEngineClaimModel): Coverage | undefined => m.coverages[0];

const getProviderFamily = (p?: Practitioner | Organization): string | undefined => {
  if (!p) return undefined;
  if (p.resourceType === 'Organization') return p.name;
  return p.name?.[0]?.family;
};

const getClaimTagCodes = (claim: Claim): string[] =>
  (claim.meta?.tag ?? [])
    .filter((t) => t.system === CLAIM_TAG_SYSTEM)
    .map((t) => t.code)
    .filter((c): c is string => !!c);

type FieldReader = (m: RulesEngineClaimModel) => string | string[] | undefined;

const READERS: Record<string, FieldReader> = {
  // The payer is the payor reference on the working-copy Coverage — always an Oystehr payer URL
  // encoding the id in the billing workspace.
  payerId: (m) => extractPayerIdFromUrl(primaryCoverage(m)?.payor?.[0]?.reference),
  'patient.firstName': (m) => m.patient?.name?.[0]?.given?.[0],
  'patient.lastName': (m) => m.patient?.name?.[0]?.family,
  'patient.birthDate': (m) => m.patient?.birthDate,
  'patient.gender': (m) => m.patient?.gender,
  'serviceFacility.name': (m) => m.serviceFacility?.name,
  'serviceFacility.npi': (m) => (m.serviceFacility ? getNPI(m.serviceFacility) : undefined),
  'serviceFacility.state': (m) => m.serviceFacility?.address?.state,
  'renderingProvider.npi': (m) => (m.renderingProvider ? getNPI(m.renderingProvider) : undefined),
  'renderingProvider.lastName': (m) => getProviderFamily(m.renderingProvider),
  tags: (m) => getClaimTagCodes(m.claim),
};

export const readField = (model: RulesEngineClaimModel, fieldId: string): string | string[] | undefined =>
  READERS[fieldId]?.(model);

// --- writers ---
//
// Every writer returns whether the value was actually applied. A write can fail because the target
// resource is missing from the model (e.g. no rendering provider on the claim) or the value is
// invalid — the engine must treat that as a rule failure, never a silent no-op, because nobody
// reviews the claim between the rules run and submission.

const PATIENT_GENDERS: NonNullable<Patient['gender']>[] = ['male', 'female', 'other', 'unknown'];

const ensurePatientName = (patient?: Patient): NonNullable<Patient['name']>[number] | undefined => {
  if (!patient) return undefined;
  if (!patient.name || patient.name.length === 0) patient.name = [{}];
  return patient.name[0];
};

// Re-point the primary coverage's payor and the claim's insurer. No RCM lookup is needed —
// getPayerUrl builds the payer reference directly from the id.
const setPayerId = (model: RulesEngineClaimModel, value: string | null): boolean => {
  if (!value) return false;
  const coverage = primaryCoverage(model);
  if (!coverage) return false;
  const payerUrl = getPayerUrl(value);
  coverage.payor = [{ reference: payerUrl }];
  model.claim.insurer = { reference: payerUrl };
  return true;
};

const setProviderFamily = (p: Practitioner | Organization | undefined, value: string | null): boolean => {
  if (!p) return false;
  if (p.resourceType === 'Organization') {
    p.name = value ?? undefined;
    return true;
  }
  if (!p.name || p.name.length === 0) p.name = [{}];
  p.name[0].family = value ?? undefined;
  return true;
};

const setGender = (patient: Patient | undefined, value: string | null): boolean => {
  if (!patient) return false;
  if (!value) {
    patient.gender = undefined;
    return true;
  }
  const match = PATIENT_GENDERS.find((g) => g === value);
  if (!match) return false;
  patient.gender = match;
  return true;
};

const setLocationState = (loc: Location | undefined, value: string | null): boolean => {
  if (!loc) return false;
  loc.address = loc.address ?? {};
  loc.address.state = value ?? undefined;
  return true;
};

type FieldWriter = (m: RulesEngineClaimModel, value: string | null) => boolean;

const WRITERS: Record<string, FieldWriter> = {
  payerId: (m, v) => setPayerId(m, v),
  'patient.firstName': (m, v) => {
    const name = ensurePatientName(m.patient);
    if (!name) return false;
    name.given = v ? [v] : undefined;
    return true;
  },
  'patient.lastName': (m, v) => {
    const name = ensurePatientName(m.patient);
    if (!name) return false;
    name.family = v ?? undefined;
    return true;
  },
  'patient.birthDate': (m, v) => {
    if (!m.patient) return false;
    m.patient.birthDate = v ?? undefined;
    return true;
  },
  'patient.gender': (m, v) => setGender(m.patient, v),
  'serviceFacility.name': (m, v) => {
    if (!m.serviceFacility) return false;
    m.serviceFacility.name = v ?? undefined;
    return true;
  },
  'serviceFacility.npi': (m, v) => {
    if (!m.serviceFacility) return false;
    setNpi(m.serviceFacility, v);
    return true;
  },
  'serviceFacility.state': (m, v) => setLocationState(m.serviceFacility, v),
  'renderingProvider.npi': (m, v) => {
    if (!m.renderingProvider) return false;
    setNpi(m.renderingProvider, v);
    return true;
  },
  'renderingProvider.lastName': (m, v) => setProviderFamily(m.renderingProvider, v),
};

// Apply a setField value to the model. Returns false when the field has no writer (unknown or
// read-only field) or the writer could not apply the value; the engine holds the claim in that case.
export const writeField = (model: RulesEngineClaimModel, fieldId: string, value: string | null): boolean => {
  const writer = WRITERS[fieldId];
  if (!writer) return false;
  return writer(model, value);
};
