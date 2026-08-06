import { randomUUID } from 'crypto';
import {
  Address,
  ChargeItemDefinition,
  Claim,
  Coverage,
  HumanName,
  Location,
  Organization,
  Patient,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import {
  CLAIM_STATUS_FIELD_KEYS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusFieldKey,
  getClaimStatusFieldValue,
  isValidClaimStatusValue,
} from 'utils/lib/types/data/billing/claim-status';
import { CLAIM_TAG_SYSTEM, PERSON_GENDER_OPTIONS } from 'utils/lib/types/data/billing/billing.constants';
import {
  CMS_PLACE_OF_SERVICE_CODE_SET,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_HL7_HCPCS,
  CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
} from 'utils/lib/helpers/rcm/constants';
import { INSURANCE_CANDID_PLAN_TYPE_CODES } from 'utils/lib/fhir/insurance';
import { STATE_CODES } from 'utils/lib/types/common';
import { SUBSCRIBER_RELATIONSHIP_CODE_MAP } from 'utils/lib/fhir/constants';
import { ServiceLineSetOperation } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { extractPayerIdFromUrl, getPayerUrl, isCLIAValid, isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { getCoveragePlanType, setCoveragePlanType } from 'utils/lib/fhir/billing';
import { getNPI, getTaxID, setNpi } from 'utils/lib/fhir/helpers';
import { getServiceLinePropertyDef } from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { isoDateRegex, taxIdRegex, zipRegex } from 'utils/lib/validation/regex';
import { getCLIA, getPlaceOfServiceCode } from '../service-facility.helpers';
import {
  buildUpdatedClaimStatusTags,
  claimHasRealCoverage,
  getClaimService,
  getClaimType,
  getClaimTypeCoding,
  getTaxonomy,
  prepareWorkingCopy,
  resourceDisplayName,
  setClaimRenderingProviderCareTeam,
  setClia,
  setTaxId,
  setTaxonomy,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';

// The rules' view of a claim: the working-copy Claim plus the working-copy resources its rules can
// read and write. Field ids map to readers and, for settable fields, writers over this model; the
// id set must stay in sync with RULE_FIELD_CATALOG in utils (which drives the rule-builder UI and
// the generated documentation) — there's a unit test guarding the pairing.

export interface RulesEngineClaimModel {
  claim: Claim;
  patient?: Patient;
  // Working-copy coverages ordered so that coverages[0] is the primary (focal) coverage.
  coverages: Coverage[];
  renderingProvider?: Practitioner | Organization;
  billingProvider?: Practitioner | Organization;
  serviceFacility?: Location;
  // Working-copy subscriber RelatedPersons of the coverages (the policy holders).
  subscribers: RelatedPerson[];
  // The reference resources (provider/facility page originals) named by the rule set's
  // "set provider/facility from list" actions, prefetched by the engine so the synchronous
  // writers can copy them. Keyed "ResourceType/id".
  referenceResources?: Map<string, Practitioner | Organization | Location>;
  // The candidate charge masters (active billing ChargeItemDefinitions carrying an insurance or
  // self-pay default tag), prefetched by the engine when the rule set applies charge master prices.
  // Read-only reference data like referenceResources: shared resources, never persisted with the
  // model — the applyChargeMasterPrices action only reads prices out of them.
  chargeMasters?: ChargeItemDefinition[];
  // Local placeholder ids of working copies minted by writers during this run. persistModel
  // POSTs them (fullUrl urn:uuid:<id>) in the same transaction as the claim's update; the
  // server resolves the claim's temporary urn references to the created ids, and the model
  // keeps the placeholder ids afterwards.
  createdCopyIds?: Set<string>;
}

// --- shared accessors ---

const primaryCoverage = (m: RulesEngineClaimModel): Coverage | undefined => m.coverages[0];
const secondaryCoverage = (m: RulesEngineClaimModel): Coverage | undefined => m.coverages[1];

// The primary policy holder: the primary coverage's subscriber when it is a standalone
// RelatedPerson (i.e. the relationship is not Self).
const primaryPolicyHolder = (m: RulesEngineClaimModel): RelatedPerson | undefined => {
  const ref = primaryCoverage(m)?.subscriber?.reference;
  if (!ref?.startsWith('RelatedPerson/')) return undefined;
  const id = ref.slice('RelatedPerson/'.length);
  return m.subscribers.find((s) => s.id === id);
};

type Provider = Practitioner | Organization;
type NamedResource = Patient | RelatedPerson | Practitioner;

// The "ResourceType/id" of the reference resource a working copy was copied from (the
// source-resource extension prepareWorkingCopy stamps). Copies made before the extension existed
// read as absent.
const sourceRef = (resource: Practitioner | Organization | Location | undefined): string | undefined =>
  resource?.extension?.find((ext) => ext.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference;

const getProviderFamily = (p?: Provider): string | undefined => {
  if (!p) return undefined;
  if (p.resourceType === 'Organization') return p.name;
  return p.name?.[0]?.family;
};

const getClaimTagCodes = (claim: Claim): string[] =>
  (claim.meta?.tag ?? [])
    .filter((t) => t.system === CLAIM_TAG_SYSTEM)
    .map((t) => t.code)
    .filter((c): c is string => !!c);

// --- service lines ---
//
// Service lines are an array, so their properties are not model fields: the updateServiceLines /
// removeServiceLines actions match and mutate them per line via these readers/writers, which pair
// with SERVICE_LINE_PROPERTY_CATALOG in utils (guarded by a unit test like the main catalog).

export type ClaimServiceLine = NonNullable<Claim['item']>[number];

const lineCptCode = (line: ClaimServiceLine): string | undefined => line.productOrService?.coding?.[0]?.code;

const lineModifiers = (line: ClaimServiceLine): string[] =>
  (line.modifier ?? []).map((mod) => mod.coding?.[0]?.code).filter((c): c is string => !!c);

const claimCptCodes = (claim: Claim): string[] => (claim.item ?? []).map(lineCptCode).filter((c): c is string => !!c);

// CPT codes billed on more than one service line (duplicate-billing detection).
const claimDuplicateCptCodes = (claim: Claim): string[] => {
  const counts = new Map<string, number>();
  for (const code of claimCptCodes(claim)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
};

type ServiceLineReader = (line: ClaimServiceLine) => string | string[] | undefined;

const SERVICE_LINE_READERS: Record<string, ServiceLineReader> = {
  cptCode: lineCptCode,
  modifiers: lineModifiers,
  units: (line) => (line.quantity?.value != null ? String(line.quantity.value) : undefined),
  charges: (line) => (line.net?.value != null ? String(line.net.value) : undefined),
  placeOfService: (line) => line.locationCodeableConcept?.coding?.[0]?.code,
  serviceDate: (line) => line.servicedPeriod?.start ?? line.servicedDate,
};

export const readServiceLineProperty = (line: ClaimServiceLine, propertyId: string): string | string[] | undefined =>
  SERVICE_LINE_READERS[propertyId]?.(line);

type ServiceLineWriter = (line: ClaimServiceLine, value: string, operation: ServiceLineSetOperation) => boolean;

const SERVICE_LINE_WRITERS: Record<string, ServiceLineWriter> = {
  cptCode: (line, value) => {
    if (!value) return false;
    // Same shape the claim editor writes: a fresh HCPCS coding (any stale display is dropped).
    line.productOrService = { coding: [{ system: CODE_SYSTEM_HL7_HCPCS, code: value }] };
    return true;
  },
  modifiers: (line, value, operation) => {
    const current = lineModifiers(line);
    let next: string[];
    if (operation === 'add') {
      if (!value) return false;
      next = current.includes(value) ? current : [...current, value];
    } else if (operation === 'remove') {
      if (!value) return false;
      next = current.filter((mod) => mod !== value);
    } else {
      // set: replace the whole list from comma-separated input; empty clears it.
      next = value
        .split(',')
        .map((mod) => mod.trim())
        .filter(Boolean);
    }
    line.modifier = next.length
      ? next.map((code) => ({ coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER, code }] }))
      : undefined;
    return true;
  },
  units: (line, value) => {
    const units = Number(value);
    if (!value || !Number.isFinite(units) || units <= 0) return false;
    line.quantity = { value: units, unit: 'UN' };
    return true;
  },
  charges: (line, value) => {
    const charges = Number(value);
    if (!value || !Number.isFinite(charges) || charges < 0) return false;
    line.net = { value: charges, currency: 'USD' };
    return true;
  },
  placeOfService: (line, value) => {
    if (value && !CMS_PLACE_OF_SERVICE_CODE_SET.has(value)) return false;
    line.locationCodeableConcept = value
      ? { coding: [{ system: CODE_SYSTEM_CMS_PLACE_OF_SERVICE, code: value }] }
      : undefined;
    return true;
  },
  serviceDate: (line, value) => {
    if (!value || !isoDateRegex.test(value)) return false;
    delete line.servicedDate;
    line.servicedPeriod = { ...line.servicedPeriod, start: value };
    return true;
  },
};

// Property ids the engine can read/write per line; used by the catalog-pairing test.
export const SERVICE_LINE_READABLE_PROPERTY_IDS: string[] = Object.keys(SERVICE_LINE_READERS);
export const SERVICE_LINE_WRITABLE_PROPERTY_IDS: string[] = Object.keys(SERVICE_LINE_WRITERS);

// Apply an updateServiceLines set to one line. Returns false for an unknown property, an operation
// that doesn't apply to the property (add/remove is list-only), or an invalid value — the engine
// treats that as a rule failure and holds the claim.
export const writeServiceLineProperty = (
  line: ClaimServiceLine,
  propertyId: string,
  value: string,
  operation: ServiceLineSetOperation
): boolean => {
  const writer = SERVICE_LINE_WRITERS[propertyId];
  if (!writer) return false;
  if (operation !== 'set' && getServiceLinePropertyDef(propertyId)?.valueType !== 'list') return false;
  return writer(line, value, operation);
};

// The claim's billed total is the sum of line charges (the invariant the claim editor maintains);
// call after any rule action that changes line charges or removes lines.
export const recomputeClaimTotal = (claim: Claim): void => {
  claim.total = {
    value: (claim.item ?? []).reduce((sum, line) => sum + (line.net?.value ?? 0), 0),
    currency: 'USD',
  };
};

const readRelationship = (coverage?: Coverage): string | undefined => {
  const coding = coverage?.relationship?.coding?.[0];
  if (!coding) return undefined;
  if (coding.display) return coding.display;
  const entry = Object.entries(SUBSCRIBER_RELATIONSHIP_CODE_MAP).find(([, code]) => code === coding.code);
  return entry?.[0] ?? coding.code;
};

type FieldReader = (m: RulesEngineClaimModel) => string | string[] | undefined;

// Readers for the name / birth date / gender / address fields a person-shaped resource (patient or
// policy holder) contributes; ids mirror the personFields entries in RULE_FIELD_CATALOG.
const personReaders = (
  prefix: string,
  resolve: (m: RulesEngineClaimModel) => Patient | RelatedPerson | undefined
): Record<string, FieldReader> => ({
  [`${prefix}.firstName`]: (m) => resolve(m)?.name?.[0]?.given?.[0],
  [`${prefix}.middleName`]: (m) => resolve(m)?.name?.[0]?.given?.[1],
  [`${prefix}.lastName`]: (m) => resolve(m)?.name?.[0]?.family,
  [`${prefix}.birthDate`]: (m) => resolve(m)?.birthDate,
  [`${prefix}.gender`]: (m) => resolve(m)?.gender,
  [`${prefix}.addressLine1`]: (m) => resolve(m)?.address?.[0]?.line?.[0],
  [`${prefix}.addressLine2`]: (m) => resolve(m)?.address?.[0]?.line?.[1],
  [`${prefix}.city`]: (m) => resolve(m)?.address?.[0]?.city,
  [`${prefix}.state`]: (m) => resolve(m)?.address?.[0]?.state,
  [`${prefix}.zip`]: (m) => resolve(m)?.address?.[0]?.postalCode,
});

// Readers for a provider (rendering or billing): Practitioner or Organization working copy.
// "lastName" doubles as the organization name; "firstName" only exists on individuals.
const providerReaders = (
  prefix: string,
  resolve: (m: RulesEngineClaimModel) => Provider | undefined
): Record<string, FieldReader> => ({
  [`${prefix}.npi`]: (m) => {
    const p = resolve(m);
    return p ? getNPI(p) : undefined;
  },
  [`${prefix}.firstName`]: (m) => {
    const p = resolve(m);
    return p?.resourceType === 'Practitioner' ? p.name?.[0]?.given?.[0] : undefined;
  },
  [`${prefix}.lastName`]: (m) => getProviderFamily(resolve(m)),
  [`${prefix}.taxonomy`]: (m) => {
    const p = resolve(m);
    return p ? getTaxonomy(p) || undefined : undefined;
  },
});

const statusFieldReaders = (): Record<string, FieldReader> =>
  Object.fromEntries(
    CLAIM_STATUS_FIELD_KEYS.map((key) => [
      `status.${key}`,
      (m: RulesEngineClaimModel): string | undefined =>
        getClaimStatusFieldValue(m.claim, CLAIM_STATUS_FIELDS_BY_KEY[key]) || undefined,
    ])
  );

const READERS: Record<string, FieldReader> = {
  // The payer is the payor reference on the working-copy Coverage — always an Oystehr payer URL
  // encoding the id in the billing workspace.
  payerId: (m) => extractPayerIdFromUrl(primaryCoverage(m)?.payor?.[0]?.reference),
  type: (m) => getClaimType(m.claim),
  service: (m) => getClaimService(m.claim),
  serviceDate: (m) => m.claim.item?.[0]?.servicedPeriod?.start ?? m.claim.item?.[0]?.servicedDate,
  created: (m) => m.claim.created,
  billingType: (m) => (claimHasRealCoverage(m.claim.insurance) ? 'Insurance Pay' : 'Self Pay'),
  billed: (m) => (m.claim.total?.value != null ? String(m.claim.total.value) : undefined),
  diagnosisCodes: (m) =>
    (m.claim.diagnosis ?? [])
      .map((dx) => dx.diagnosisCodeableConcept?.coding?.[0]?.code)
      .filter((c): c is string => !!c),
  cptCodes: (m) => claimCptCodes(m.claim),
  duplicateCptCodes: (m) => claimDuplicateCptCodes(m.claim),
  placeOfServiceCodes: (m) =>
    (m.claim.item ?? []).map((item) => item.locationCodeableConcept?.coding?.[0]?.code).filter((c): c is string => !!c),
  serviceLineCount: (m) => String(m.claim.item?.length ?? 0),

  ...statusFieldReaders(),

  ...personReaders('patient', (m) => m.patient),

  'insurance.memberId': (m) => primaryCoverage(m)?.subscriberId,
  'insurance.planType': (m) => getCoveragePlanType(primaryCoverage(m)),
  'insurance.relationship': (m) => readRelationship(primaryCoverage(m)),

  ...personReaders('policyHolder', primaryPolicyHolder),

  'secondaryInsurance.payerId': (m) => extractPayerIdFromUrl(secondaryCoverage(m)?.payor?.[0]?.reference),
  'secondaryInsurance.memberId': (m) => secondaryCoverage(m)?.subscriberId,

  'renderingProvider.ref': (m) => sourceRef(m.renderingProvider),
  ...providerReaders('renderingProvider', (m) => m.renderingProvider),
  'billingProvider.ref': (m) => sourceRef(m.billingProvider),
  ...providerReaders('billingProvider', (m) => m.billingProvider),
  'billingProvider.taxId': (m) => (m.billingProvider ? getTaxID(m.billingProvider) : undefined),

  'serviceFacility.ref': (m) => sourceRef(m.serviceFacility),
  'serviceFacility.name': (m) => m.serviceFacility?.name,
  'serviceFacility.npi': (m) => (m.serviceFacility ? getNPI(m.serviceFacility) : undefined),
  'serviceFacility.clia': (m) => (m.serviceFacility ? getCLIA(m.serviceFacility) : undefined),
  'serviceFacility.posCode': (m) => (m.serviceFacility ? getPlaceOfServiceCode(m.serviceFacility) : undefined),
  'serviceFacility.addressLine1': (m) => m.serviceFacility?.address?.line?.[0],
  'serviceFacility.addressLine2': (m) => m.serviceFacility?.address?.line?.[1],
  'serviceFacility.city': (m) => m.serviceFacility?.address?.city,
  'serviceFacility.state': (m) => m.serviceFacility?.address?.state,
  'serviceFacility.zip': (m) => m.serviceFacility?.address?.postalCode,

  tags: (m) => getClaimTagCodes(m.claim),
};

export const readField = (model: RulesEngineClaimModel, fieldId: string): string | string[] | undefined =>
  READERS[fieldId]?.(model);

// --- writers ---
//
// Every writer returns whether the value was actually applied. A write can fail because the target
// resource is missing from the model (e.g. no rendering provider on the claim) or the value is
// invalid — the engine must treat that as a rule failure, never a silent no-op, because nobody
// reviews the claim between the rules run and submission. Writers accept an empty value as "clear
// the property" wherever the underlying resource allows it.

const PERSON_GENDERS = PERSON_GENDER_OPTIONS.map((option) => option.value);

const ensureName = (resource: NamedResource): HumanName => {
  if (!resource.name || resource.name.length === 0) resource.name = [{}];
  return resource.name[0];
};

// Compute a positional given/line array update. Returns undefined when the result would keep a
// leading empty slot (a middle name with no first name, or clearing address line 1 while line 2
// remains) — empty strings are invalid FHIR, so such writes must fail the rule instead. Validates
// before any mutation so a failed write leaves the resource untouched.
const positionalEntries = (
  current: readonly string[] | undefined,
  index: number,
  value: string | null
): string[] | undefined => {
  const entries = [...(current ?? [])];
  while (entries.length <= index) entries.push('');
  entries[index] = value ?? '';
  while (entries.length > 0 && entries[entries.length - 1] === '') entries.pop();
  return entries.some((entry) => entry === '') ? undefined : entries;
};

const setGivenAt = (resource: NamedResource, index: number, value: string | null): boolean => {
  const entries = positionalEntries(resource.name?.[0]?.given, index, value);
  if (!entries) return false;
  if (entries.length === 0) {
    if (resource.name?.[0]) resource.name[0].given = undefined;
    return true;
  }
  ensureName(resource).given = entries;
  return true;
};

const ensurePersonAddress = (person: Patient | RelatedPerson): Address => {
  if (!person.address || person.address.length === 0) person.address = [{}];
  return person.address[0];
};

const setPersonAddressLine = (person: Patient | RelatedPerson, index: number, value: string | null): boolean => {
  const entries = positionalEntries(person.address?.[0]?.line, index, value);
  if (!entries) return false;
  if (entries.length === 0) {
    if (person.address?.[0]) person.address[0].line = undefined;
    return true;
  }
  ensurePersonAddress(person).line = entries;
  return true;
};

const setPersonGender = (person: Patient | RelatedPerson | undefined, value: string | null): boolean => {
  if (!person) return false;
  if (!value) {
    person.gender = undefined;
    return true;
  }
  const match = PERSON_GENDERS.find((g) => g === value);
  if (!match) return false;
  person.gender = match;
  return true;
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

const setSecondaryPayerId = (model: RulesEngineClaimModel, value: string | null): boolean => {
  if (!value) return false;
  const coverage = secondaryCoverage(model);
  if (!coverage) return false;
  coverage.payor = [{ reference: getPayerUrl(value) }];
  return true;
};

// Register a writer-minted working copy: give it a local placeholder id (persistModel POSTs it
// under fullUrl urn:uuid:<id> and the server resolves the claim's urn references to the created
// id), and drop a pending copy it supersedes (a second swap of the same slot in one run) so the
// superseded copy is never created. Returns the temporary urn reference.
const registerCreatedCopy = (
  model: RulesEngineClaimModel,
  replaced: { id?: string } | undefined,
  copy: { id?: string }
): string => {
  copy.id = randomUUID();
  const created = (model.createdCopyIds ??= new Set<string>());
  if (replaced?.id && created.has(replaced.id)) created.delete(replaced.id);
  created.add(copy.id);
  return `urn:uuid:${copy.id}`;
};

// Replace the claim's rendering/billing provider or service facility with a fresh working copy of a
// reference resource picked from the provider/facility pages — the same swap update-billing-claim
// performs. Writers are synchronous, so the original must have been prefetched into
// model.referenceResources (the engine collects the rule set's refs up front); a missing or
// type-mismatched ref fails the rule. The model slot is replaced so later rules read and edit the
// new copy, and the copy is persisted with those later edits already applied.
const setClaimResourceRef = (
  model: RulesEngineClaimModel,
  slot: 'renderingProvider' | 'billingProvider' | 'serviceFacility',
  value: string | null
): boolean => {
  const original = value ? model.referenceResources?.get(value) : undefined;
  if (!original?.id) return false;

  if (slot === 'serviceFacility') {
    if (original.resourceType !== 'Location') return false;
    const copy = prepareWorkingCopy<Location>(original, original.id);
    const reference = registerCreatedCopy(model, model.serviceFacility, copy);
    model.serviceFacility = copy;
    model.claim.facility = { reference, display: resourceDisplayName(copy) };
    return true;
  }

  if (original.resourceType === 'Location') return false;
  const copy =
    original.resourceType === 'Practitioner'
      ? prepareWorkingCopy<Practitioner>(original, original.id)
      : prepareWorkingCopy<Organization>(original, original.id);
  const reference = registerCreatedCopy(model, model[slot], copy);
  model[slot] = copy;
  if (slot === 'billingProvider') {
    model.claim.provider = { reference, display: resourceDisplayName(copy) };
    return true;
  }
  // The rendering provider rides on careTeam sequence 1, and every item must point at it.
  setClaimRenderingProviderCareTeam(model.claim, { reference, display: resourceDisplayName(copy) });
  return true;
};

const setProviderFamily = (p: Provider | undefined, value: string | null): boolean => {
  if (!p) return false;
  // `|| undefined`: an empty value clears the field — a literal '' is invalid FHIR.
  if (p.resourceType === 'Organization') {
    p.name = value || undefined;
    return true;
  }
  ensureName(p).family = value || undefined;
  return true;
};

const setClaimType = (claim: Claim, value: string | null): boolean => {
  if (value !== CODE_SYSTEM_CLAIM_TYPE_CODES.professional && value !== CODE_SYSTEM_CLAIM_TYPE_CODES.institutional) {
    return false;
  }
  // Mirror update-billing-claim: the type lives both on Claim.type and as a meta tag.
  const coding = getClaimTypeCoding(value);
  claim.type = { coding: [coding] };
  claim.meta = claim.meta ?? {};
  claim.meta.tag = [...(claim.meta.tag ?? []).filter((t) => t.system !== CODE_SYSTEM_CLAIM_TYPE), coding];
  return true;
};

const setClaimService = (claim: Claim, value: string | null): boolean => {
  claim.meta = claim.meta ?? {};
  const rest = (claim.meta.tag ?? []).filter((t) => t.system !== CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM);
  claim.meta.tag = value ? [...rest, { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: value }] : rest;
  return true;
};

// Claim-level DOS: the one date applies to every service line (matches the claim editor's
// one-DOS-per-claim model). Fails when the claim has no service lines to date.
const setServiceDate = (claim: Claim, value: string | null): boolean => {
  if (!value || !isoDateRegex.test(value)) return false;
  if (!claim.item?.length) return false;
  claim.item = claim.item.map(({ servicedDate: _replacedByPeriod, ...item }) => ({
    ...item,
    servicedPeriod: { ...item.servicedPeriod, start: value },
  }));
  return true;
};

const writeStatusField = (claim: Claim, key: ClaimStatusFieldKey, value: string | null): boolean => {
  const code = value ?? '';
  if (!isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY[key], code)) return false;
  claim.meta = claim.meta ?? {};
  claim.meta.tag = buildUpdatedClaimStatusTags(claim, key, code);
  return true;
};

const writePlanType = (model: RulesEngineClaimModel, value: string | null): boolean => {
  const coverage = primaryCoverage(model);
  if (!coverage || !value || !INSURANCE_CANDID_PLAN_TYPE_CODES.includes(value)) return false;
  // setCoveragePlanType returns an updated copy; swap it into the model (same resource id, so the
  // engine's snapshot/dirty check still pairs it with the original).
  model.coverages[0] = setCoveragePlanType(coverage, value);
  return true;
};

type FieldWriter = (m: RulesEngineClaimModel, value: string | null) => boolean;

// Writer-side value guard: a non-empty value must pass the same check save-time validation runs
// (empty keeps each writer's own clear/reject semantics). The engine holds the claim on failure.
const validOrEmpty = (value: string | null | undefined, check: (v: string) => boolean): boolean =>
  !value || check(value);

// Writers for the person-shaped fields (patient / policy holder), paired with personReaders.
const personWriters = (
  prefix: string,
  resolve: (m: RulesEngineClaimModel) => Patient | RelatedPerson | undefined
): Record<string, FieldWriter> => {
  const withPerson =
    (write: (person: Patient | RelatedPerson, value: string | null) => boolean | void): FieldWriter =>
    (m, value) => {
      const person = resolve(m);
      if (!person) return false;
      return write(person, value) ?? true;
    };
  return {
    [`${prefix}.firstName`]: withPerson((p, v) => setGivenAt(p, 0, v)),
    [`${prefix}.middleName`]: withPerson((p, v) => setGivenAt(p, 1, v)),
    [`${prefix}.lastName`]: withPerson((p, v) => {
      ensureName(p).family = v || undefined;
    }),
    [`${prefix}.birthDate`]: withPerson((p, v) => {
      if (!validOrEmpty(v, (d) => isoDateRegex.test(d))) return false;
      p.birthDate = v || undefined;
      return true;
    }),
    [`${prefix}.gender`]: (m, v) => setPersonGender(resolve(m), v),
    [`${prefix}.addressLine1`]: withPerson((p, v) => setPersonAddressLine(p, 0, v)),
    [`${prefix}.addressLine2`]: withPerson((p, v) => setPersonAddressLine(p, 1, v)),
    [`${prefix}.city`]: withPerson((p, v) => {
      ensurePersonAddress(p).city = v || undefined;
    }),
    [`${prefix}.state`]: withPerson((p, v) => {
      if (!validOrEmpty(v, (s) => STATE_CODES.has(s))) return false;
      ensurePersonAddress(p).state = v || undefined;
      return true;
    }),
    [`${prefix}.zip`]: withPerson((p, v) => {
      if (!validOrEmpty(v, (z) => zipRegex.test(z))) return false;
      ensurePersonAddress(p).postalCode = v || undefined;
      return true;
    }),
  };
};

// Writers for a provider (rendering or billing), paired with providerReaders.
const providerWriters = (
  prefix: string,
  resolve: (m: RulesEngineClaimModel) => Provider | undefined
): Record<string, FieldWriter> => ({
  [`${prefix}.npi`]: (m, v) => {
    const p = resolve(m);
    if (!p || !validOrEmpty(v, isNPIValidWithChecksum)) return false;
    setNpi(p, v);
    return true;
  },
  [`${prefix}.firstName`]: (m, v) => {
    const p = resolve(m);
    // Only individual providers have a first name; setting one on an organization fails the rule.
    if (!p || p.resourceType !== 'Practitioner') return false;
    return setGivenAt(p, 0, v);
  },
  [`${prefix}.lastName`]: (m, v) => setProviderFamily(resolve(m), v),
  [`${prefix}.taxonomy`]: (m, v) => {
    const p = resolve(m);
    if (!p || !validOrEmpty(v, (t) => t.trim().length === 10)) return false;
    setTaxonomy(p, v ?? '');
    return true;
  },
});

const statusFieldWriters = (): Record<string, FieldWriter> =>
  Object.fromEntries(
    CLAIM_STATUS_FIELD_KEYS.map((key) => [
      `status.${key}`,
      (m: RulesEngineClaimModel, v: string | null): boolean => writeStatusField(m.claim, key, v),
    ])
  );

// A facility writer: fails when the claim has no service facility, then applies the edit.
const withFacility =
  (write: (facility: Location, value: string | null) => boolean | void): FieldWriter =>
  (m, value) => {
    if (!m.serviceFacility) return false;
    return write(m.serviceFacility, value) ?? true;
  };

const ensureFacilityAddress = (facility: Location): Address => {
  facility.address = facility.address ?? {};
  return facility.address;
};

const setFacilityAddressLine = (facility: Location, index: number, value: string | null): boolean => {
  const entries = positionalEntries(facility.address?.line, index, value);
  if (!entries) return false;
  if (entries.length === 0) {
    if (facility.address) facility.address.line = undefined;
    return true;
  }
  ensureFacilityAddress(facility).line = entries;
  return true;
};

const setFacilityPosCode = (facility: Location, value: string | null): void => {
  const rest = (facility.extension ?? []).filter((ext) => ext.url !== CODE_SYSTEM_CMS_PLACE_OF_SERVICE);
  facility.extension = value ? [...rest, { url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE, valueString: value }] : rest;
  if (facility.extension.length === 0) facility.extension = undefined;
};

const WRITERS: Record<string, FieldWriter> = {
  payerId: (m, v) => setPayerId(m, v),
  type: (m, v) => setClaimType(m.claim, v),
  service: (m, v) => setClaimService(m.claim, v),
  serviceDate: (m, v) => setServiceDate(m.claim, v),

  ...statusFieldWriters(),

  ...personWriters('patient', (m) => m.patient),

  'insurance.memberId': (m, v) => {
    const coverage = primaryCoverage(m);
    if (!coverage) return false;
    coverage.subscriberId = v || undefined;
    return true;
  },
  'insurance.planType': (m, v) => writePlanType(m, v),

  ...personWriters('policyHolder', primaryPolicyHolder),

  'secondaryInsurance.payerId': (m, v) => setSecondaryPayerId(m, v),
  'secondaryInsurance.memberId': (m, v) => {
    const coverage = secondaryCoverage(m);
    if (!coverage) return false;
    coverage.subscriberId = v || undefined;
    return true;
  },

  'renderingProvider.ref': (m, v) => setClaimResourceRef(m, 'renderingProvider', v),
  ...providerWriters('renderingProvider', (m) => m.renderingProvider),
  'billingProvider.ref': (m, v) => setClaimResourceRef(m, 'billingProvider', v),
  ...providerWriters('billingProvider', (m) => m.billingProvider),
  'billingProvider.taxId': (m, v) => {
    if (!m.billingProvider || !validOrEmpty(v, (t) => taxIdRegex.test(t))) return false;
    setTaxId(m.billingProvider, v ?? '');
    return true;
  },

  'serviceFacility.ref': (m, v) => setClaimResourceRef(m, 'serviceFacility', v),
  'serviceFacility.name': withFacility((f, v) => {
    f.name = v || undefined;
  }),
  'serviceFacility.npi': withFacility((f, v) => {
    if (!validOrEmpty(v, isNPIValidWithChecksum)) return false;
    setNpi(f, v);
    return true;
  }),
  'serviceFacility.clia': withFacility((f, v) => {
    if (!validOrEmpty(v, isCLIAValid)) return false;
    setClia(f, v || null);
    return true;
  }),
  'serviceFacility.posCode': withFacility((f, v) => {
    if (!validOrEmpty(v, (code) => CMS_PLACE_OF_SERVICE_CODE_SET.has(code))) return false;
    setFacilityPosCode(f, v);
    return true;
  }),
  'serviceFacility.addressLine1': withFacility((f, v) => setFacilityAddressLine(f, 0, v)),
  'serviceFacility.addressLine2': withFacility((f, v) => setFacilityAddressLine(f, 1, v)),
  'serviceFacility.city': withFacility((f, v) => {
    ensureFacilityAddress(f).city = v || undefined;
  }),
  'serviceFacility.state': withFacility((f, v) => {
    if (!validOrEmpty(v, (s) => STATE_CODES.has(s))) return false;
    ensureFacilityAddress(f).state = v || undefined;
    return true;
  }),
  'serviceFacility.zip': withFacility((f, v) => {
    if (!validOrEmpty(v, (z) => zipRegex.test(z))) return false;
    ensureFacilityAddress(f).postalCode = v || undefined;
    return true;
  }),
};

// Field ids the engine can read/write; used by the catalog-pairing test.
export const READABLE_FIELD_IDS: string[] = Object.keys(READERS);
export const WRITABLE_FIELD_IDS: string[] = Object.keys(WRITERS);

// Apply a setField value to the model. Returns false when the field has no writer (unknown or
// read-only field) or the writer could not apply the value; the engine holds the claim in that case.
export const writeField = (model: RulesEngineClaimModel, fieldId: string, value: string | null): boolean => {
  const writer = WRITERS[fieldId];
  if (!writer) return false;
  return writer(model, value);
};
