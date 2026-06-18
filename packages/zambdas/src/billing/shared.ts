import Oystehr from '@oystehr/sdk';
import {
  Account,
  Address,
  Basic,
  Claim,
  Coding,
  Coverage,
  FhirResource,
  Identifier,
  Location,
  Organization,
  Patient,
  Person,
  Practitioner,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import {
  ACCOUNT_TYPE_CODE_SYSTEM,
  BillingInsuranceType,
  BillingPolicyHolderInput,
  BillingSubscriberRelationship,
  CANDID_PLAN_TYPE_SYSTEM,
  CODE_SYSTEM_APPOINTMENT_TYPE_CODES,
  CODE_SYSTEM_APPOINTMENT_TYPE_TAG_SYSTEM,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  convertFhirNameToDisplayName,
  createCoverageMemberIdentifier,
  createFhirHumanName,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  FHIR_RESOURCE_NOT_FOUND,
  getPayerId,
  getPayerUrl,
  isPayerUrl,
  isValidUUID,
  mapBirthSexToGender,
  PATIENT_BILLING_ACCOUNT_TYPE,
  Secrets,
  SUBSCRIBER_RELATIONSHIP_CODE_MAP,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils';
import { createOystehrClient } from '../shared/helpers';

// Type alias for resources relevant to billing
export type BillingFhirResource =
  | Patient
  | Coverage
  | Practitioner
  | Organization
  | Location
  | Person
  | Claim
  | Account
  | RelatedPerson
  | Basic;

export const BILLING_RESOURCE_TAG = {
  system: 'https://fhir.ottehr.com/billing/resource-type',
  code: 'billing-resource',
};

export const BILLING_WORKING_COPY_TAG = {
  system: 'https://fhir.ottehr.com/billing/resource-type',
  code: 'billing-working-copy',
};

export const CURRENT_STATUS_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/current-status';

// TODO: this function has fallback chain so it is hard to return enum and we don't have standardized status codes yet
export function getClaimStatus(claim: Claim): string {
  return claim.meta?.tag?.find((t) => t.system === CURRENT_STATUS_TAG_SYSTEM)?.code ?? claim.status ?? 'unknown';
}

export function sortClaimInsurance(claim: Pick<Claim, 'insurance'>): NonNullable<Claim['insurance']> {
  return [...(claim.insurance ?? [])].sort((a, b) => a.sequence - b.sequence);
}

// Resolve Oystehr payer list URLs to payer Organizations via the RCM service
export async function resolvePayersByRef(
  oystehr: Oystehr,
  refs: (string | undefined)[]
): Promise<Map<string, Organization>> {
  const byRef = new Map<string, Organization>();
  const uniqueRefs = [...new Set(refs.filter((r): r is string => !!r))];
  await Promise.all(
    uniqueRefs.map(async (ref) => {
      if (!isPayerUrl(ref)) return;
      try {
        byRef.set(ref, await oystehr.rcm.getPayerByUrl({ url: ref }));
      } catch (err) {
        console.error(`Failed to resolve payer ${ref}:`, err);
      }
    })
  );
  return byRef;
}

// Provider role: one tag system  (a provider can bill and/or render).
export const PROVIDER_ROLE_TAG = 'https://fhir.ottehr.com/billing/provider-role';
export const PROVIDER_ROLE_BILLING = 'billing';
export const PROVIDER_ROLE_RENDERING = 'rendering';
export const LICENSE_TAG = 'https://fhir.ottehr.com/billing/license-type';

export const SOURCE_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/billing/source-resource';
export const ERA_ID_SYSTEM = 'https://identifiers.fhir.oystehr.com/era-id';
export const ERA_CHECK_SYSTEM = 'https://identifiers.fhir.oystehr.com/era-check-number';

export const TAG_CODE_SYSTEM = 'https://fhir.ottehr.com/billing/tag';
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';
export const TAG_DESCRIPTION_URL = 'https://fhir.ottehr.com/billing/tag-description';
export const TAG_IS_SYSTEM_TAG_URL = 'https://fhir.ottehr.com/billing/is-system-tag';

export function isSystemTag(tag: Basic): boolean {
  return tag.extension?.some((ext) => ext.url === TAG_IS_SYSTEM_TAG_URL && ext.valueBoolean === true) ?? false;
}

export const AUTO_ACCIDENT_TAG_NAME = 'auto-accident';
export const AUTO_ACCIDENT_TAG_DESCRIPTION = 'Claim is for a clinical encounter resulting from an auto accident';

const PROTECTED_OVERRIDE_KEYS = new Set(['id', 'meta', 'resourceType', 'extension']);

export function sanitizeOverrides(overrides?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!overrides) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!PROTECTED_OVERRIDE_KEYS.has(key)) clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

// Working copy visibility convention:
// List pages (default view): exclude working copies (only show billing originals)
// List pages (active search): include working copies via includeWorkingCopies param
// Autocomplete dropdowns (Create Claim, etc.): never include working copies
export const EXCLUDE_WORKING_COPIES_PARAMS = [
  { name: '_tag:not', value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}` },
];

export function createBillingClient(token: string, secrets: Secrets | null): Oystehr {
  return createOystehrClient(token, secrets, { workspaceTag: BILLING_RESOURCE_TAG });
}

export async function fetchById<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  id: string
): Promise<T> {
  const result = await oystehr.fhir.search<T>({ resourceType, params: [{ name: '_id', value: id }] });
  const resource = result.unbundle()[0];
  if (!resource) throw FHIR_RESOURCE_NOT_FOUND(resourceType);
  return resource;
}

export function getTag(resource: Resource, system: string): string | undefined {
  return resource.meta?.tag?.find((t) => t.system === system)?.code;
}

// Valid 1-based pointers into the claim's diagnosis list; falls back to the first diagnosis.
export function buildDiagnosisSequence(pointers: number[] | undefined, diagnosisCount: number): number[] | undefined {
  const valid = [...new Set((pointers ?? []).filter((p) => p <= diagnosisCount))];
  if (valid.length) return valid;
  return diagnosisCount ? [1] : undefined;
}

// A resource can carry multiple tags in the same system (e.g. both provider roles), so check (system, code).
export function hasTag(resource: Resource, system: string, code: string): boolean {
  return resource.meta?.tag?.some((t) => t.system === system && t.code === code) ?? false;
}

export function formatAddress(addr?: { line?: string[]; city?: string; state?: string; postalCode?: string }): string {
  if (!addr) return '';
  return [...(addr.line ?? []), addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
}

export function toAddressParts(addr?: Address): {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
} {
  return {
    line1: addr?.line?.[0] ?? '',
    line2: addr?.line?.[1] ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    postalCode: addr?.postalCode ?? '',
  };
}

export function buildAddress(parts: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): Address {
  const line = [parts.line1, parts.line2].filter((l): l is string => !!l);
  return {
    ...(line.length ? { line } : {}),
    city: parts.city,
    state: parts.state,
    postalCode: parts.postalCode,
  };
}

export function setNpi(resource: Practitioner | Organization | Location, npi: string): void {
  const identifier = resource.identifier ?? [];
  const existing = identifier.find((id) => id.system === FHIR_IDENTIFIER_NPI);
  if (npi) {
    if (existing) existing.value = npi;
    else identifier.push({ system: FHIR_IDENTIFIER_NPI, value: npi });
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => id.system !== FHIR_IDENTIFIER_NPI);
  }
}

export function setTaxId(resource: Practitioner | Organization, taxId: string): void {
  const isTax = (id: Identifier): boolean =>
    !!id.type?.coding?.some(
      (tc) =>
        tc.system === FHIR_IDENTIFIER_SYSTEM &&
        (tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER || tc.code === FHIR_IDENTIFIER_CODE_TAX_SS)
    );
  const identifier = resource.identifier ?? [];
  const existing = identifier.find(isTax);
  if (taxId) {
    if (existing) existing.value = taxId;
    else {
      identifier.push({
        type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAX_EMPLOYER }] },
        value: taxId,
      });
    }
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => !isTax(id));
  }
}

export function setTaxonomy(resource: Practitioner | Organization, taxonomyCode: string): void {
  const isTaxonomy = (id: Identifier): boolean =>
    !!id.type?.coding?.some((tc) => tc.code === FHIR_IDENTIFIER_CODE_TAXONOMY);
  const identifier = resource.identifier ?? [];
  const existing = identifier.find(isTaxonomy);
  if (taxonomyCode) {
    if (existing) existing.value = taxonomyCode;
    else {
      identifier.push({
        type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: FHIR_IDENTIFIER_CODE_TAXONOMY }] },
        value: taxonomyCode,
      });
    }
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => !isTaxonomy(id));
  }
}

export function fhirName(resource?: Patient | Practitioner): string {
  const name = resource?.name?.[0];
  return name ? convertFhirNameToDisplayName(name) : '';
}

/**
 * Clone a billing resource into a working copy: strips id, tags it, adds source identifier.
 */
export function prepareWorkingCopy<T extends CopyableBillingResource>(resource: CRT<T>, originalId?: string): CRT<T> {
  const copy = prepareCopy<T>(resource, originalId);
  // Keep provider role/license tags so the snapshot mirrors the original; the working-copy tag
  // is what keeps it out of default lists and pick lists, not the absence of role tags.
  const providerTags = (resource.meta?.tag ?? []).filter(
    (t) => t.system === PROVIDER_ROLE_TAG || t.system === LICENSE_TAG
  );
  copy.meta = { tag: [...providerTags, BILLING_WORKING_COPY_TAG] };
  return copy;
}

/**
 * Clone a billing resource into a working copy: strips id, tags it, adds source identifier.
 */
export function prepareCopy<T extends CopyableBillingResource>(resource: CRT<T>, originalId?: string): CRT<T> {
  const propHolder: Partial<Writable<CRT<T>>> = {};
  const resourceProps = copyableProps(resource);
  for (const prop of resourceProps) {
    if (resource[prop]) {
      propHolder[prop] = resource[prop];
    }
  }
  const copy: CRT<T> = structuredClone(propHolder) as CRT<T>;
  delete copy.id;
  const existing = (copy.extension ?? []).filter((ext) => ext.url !== SOURCE_IDENTIFIER_SYSTEM);
  copy.extension = [
    ...existing,
    ...(originalId
      ? [
          {
            url: SOURCE_IDENTIFIER_SYSTEM,
            valueReference: {
              reference: originalId.startsWith('urn:uuid:') ? originalId : `${resource.resourceType}/${originalId}`,
            },
          },
        ]
      : []),
  ];
  return copy;
}

/**
 * Map of resource types and their valid properties
 */
type ResourceProperties<Resources extends BillingFhirResource> = { [R in Resources as R['resourceType']]: (keyof R)[] };
/**
 * Billing resources that are eligible to be copied
 */
export type CopyableBillingResource = Exclude<BillingFhirResource, Claim | Person | Basic>;
/**
 * Extracts the specific billing resource out of the union type
 */
type CRT<T extends CopyableBillingResource> = Extract<CopyableBillingResource, { resourceType: T['resourceType'] }>;
/**
 * List of copyable properties for each resource type
 */
const CopyableProperties: ResourceProperties<CopyableBillingResource> = {
  Account: ['resourceType', 'status', 'type', 'subject', 'guarantor', 'coverage', 'contained'],
  Coverage: ['resourceType', 'status', 'subscriber', 'beneficiary', 'payor', 'subscriberId', 'relationship', 'class'],
  Location: ['resourceType', 'address', 'description', 'name', 'telecom', 'type'],
  Organization: ['resourceType', 'active', 'address', 'contact', 'name', 'telecom', 'type'],
  Patient: ['resourceType', 'name', 'active', 'gender', 'address', 'telecom', 'birthDate'],
  Practitioner: ['resourceType', 'active', 'address', 'birthDate', 'gender', 'name', 'qualification', 'telecom'],
  RelatedPerson: ['resourceType', 'name', 'birthDate', 'gender', 'patient', 'address', 'relationship'],
} as const;
/**
 * Helper to remove readonly from fields
 */
type Writable<T> = { -readonly [K in keyof T]: T[K] };
/**
 * Helper to handle types for CopyableProperties
 * @param r
 * @returns
 */
function copyableProps<R extends CopyableBillingResource>(r: CRT<R>): (keyof CRT<R>)[] {
  const props = CopyableProperties[r.resourceType];
  return props as (keyof CRT<R>)[];
}

// Resolve FHIR reference like "Patient/uuid-12345" from resource array.
export function findRef<T extends Resource>(resources: Resource[], reference?: string): T | undefined {
  if (!reference) return undefined;
  const id = reference.includes('/') ? reference.split('/')[1] : reference;
  return resources.find((r) => r.id === id) as T | undefined;
}

export function getClaimType(claim: Claim): keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES {
  const code = claim.type.coding?.find((c) => c.system === CODE_SYSTEM_CLAIM_TYPE)?.code;
  if (!code) {
    return CODE_SYSTEM_CLAIM_TYPE_CODES.professional;
  }
  switch (code) {
    case 'professional':
      return CODE_SYSTEM_CLAIM_TYPE_CODES.professional;
    case 'institutional':
      return CODE_SYSTEM_CLAIM_TYPE_CODES.institutional;
    default:
      // Currently all claims start as professional claims
      return CODE_SYSTEM_CLAIM_TYPE_CODES.professional;
  }
}

export function getClaimTypeCoding(type?: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES): Coding {
  // Currently all claims start as professional claims
  return { system: CODE_SYSTEM_CLAIM_TYPE, code: type ?? CODE_SYSTEM_CLAIM_TYPE_CODES.professional };
}

export function getClaimAppointmentType(claim: Claim): keyof typeof CODE_SYSTEM_APPOINTMENT_TYPE_CODES | undefined {
  const code = claim.meta?.tag?.find((c) => c.system === CODE_SYSTEM_APPOINTMENT_TYPE_TAG_SYSTEM)?.code;
  if (!code) {
    return undefined;
  }
  if (!Object.hasOwn(CODE_SYSTEM_APPOINTMENT_TYPE_CODES, code)) {
    return undefined;
  }
  return code as keyof typeof CODE_SYSTEM_APPOINTMENT_TYPE_CODES;
}

// --- Coverage / insurance helpers ---
//
// Billing-local copy of the clinical EHR's Coverage construction (see
// packages/zambdas/src/ehr/shared/harvest/index.ts createCoverageResource). Kept separate on
// purpose so edits to the billing CRUD flow don't reach into the clinical intake path; the
// emitted FHIR shape (relationship coding, standalone RelatedPerson subscriber, payor reference)
// is intentionally identical so coverages created here behave like clinically-created ones.

export const SUBSCRIBER_RELATIONSHIP_SYSTEM = 'http://terminology.hl7.org/CodeSystem/subscriber-relationship';
export const RELATED_PERSON_RELATIONSHIP_SYSTEM = 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype';
// Legacy: coverages created before subscribers were standalone embedded the RelatedPerson here.
export const COVERAGE_SUBSCRIBER_CONTAINED_ID = 'coverageSubscriber';

function relationshipCodeFor(relationship: BillingSubscriberRelationship): string {
  return SUBSCRIBER_RELATIONSHIP_CODE_MAP[relationship] || 'other';
}

function buildPayorReference(payerOrg: Organization): string {
  const payerId = getPayerId(payerOrg);
  if (isValidUUID(payerOrg.id ?? '')) return `Organization/${payerOrg.id}`;
  if (!payerId) throw new Error('payerId unexpectedly missing from payer organization');
  return getPayerUrl(payerId);
}

// Set the Coverage.relationship CodeableConcept (subscriber-relationship system).
export function setCoverageRelationship(coverage: Coverage, relationship: BillingSubscriberRelationship): void {
  coverage.relationship = {
    coding: [
      { system: SUBSCRIBER_RELATIONSHIP_SYSTEM, code: relationshipCodeFor(relationship), display: relationship },
    ],
  };
}

// Build a standalone RelatedPerson policy holder (the coverage subscriber for non-self relationships).
// Matches create-billing-claim-from-encounter, which uses a referenced RelatedPerson rather than a
// contained one.
export function buildSubscriberRelatedPerson(
  patientId: string,
  relationship: BillingSubscriberRelationship,
  policyHolder: BillingPolicyHolderInput
): RelatedPerson {
  const relationshipCode = relationshipCodeFor(relationship);
  return {
    resourceType: 'RelatedPerson',
    name: createFhirHumanName(policyHolder.firstName, policyHolder.middleName, policyHolder.lastName),
    birthDate: policyHolder.dob,
    gender: mapBirthSexToGender(policyHolder.birthSex),
    patient: { reference: `Patient/${patientId}` },
    address: policyHolder.address ? [buildAddress(policyHolder.address)] : undefined,
    relationship: [
      { coding: [{ system: RELATED_PERSON_RELATIONSHIP_SYSTEM, code: relationshipCode, display: relationship }] },
    ],
  };
}

// Set payor reference + coverage class + member-id identifier from a payer Organization.
export function setCoveragePayer(coverage: Coverage, payerOrg: Organization, memberId: string): void {
  const payerId = getPayerId(payerOrg);
  coverage.payor = [{ reference: buildPayorReference(payerOrg) }];
  coverage.class = [
    {
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
      value: payerId ?? '',
      name: payerOrg.name ?? '',
    },
  ];
  coverage.identifier = [createCoverageMemberIdentifier(memberId, payerOrg)];
}

// Coverage.type plan-type code that marks a coverage as workers' comp (matches the clinical EHR).
export const WORKERS_COMP_COVERAGE_TYPE_CODE = 'WC';

// Apply insurance-type markers on the Coverage itself: order for primary/secondary, and the WC
// plan-type coding for workers comp (cleared otherwise). The authoritative placement is still the
// Account the coverage is linked to; these markers are a fallback for unlinked coverages.
export function applyInsuranceTypeToCoverage(coverage: Coverage, insuranceType: BillingInsuranceType): void {
  if (coverage.type?.coding) {
    coverage.type.coding = coverage.type.coding.filter(
      (c) => !(c.system === CANDID_PLAN_TYPE_SYSTEM && c.code === WORKERS_COMP_COVERAGE_TYPE_CODE)
    );
    if (coverage.type.coding.length === 0) delete coverage.type;
  }
  if (insuranceType === 'workersComp') {
    delete coverage.order;
    coverage.type = {
      coding: [
        ...(coverage.type?.coding ?? []),
        { system: CANDID_PLAN_TYPE_SYSTEM, code: WORKERS_COMP_COVERAGE_TYPE_CODE },
      ],
    };
  } else {
    coverage.order = insuranceType === 'secondary' ? 2 : 1;
  }
}

export function buildBillingCoverage(params: {
  patientId: string;
  payerOrg: Organization;
  memberId: string;
  status: Coverage['status'];
  insuranceType: BillingInsuranceType;
  relationship: BillingSubscriberRelationship;
  // 'Patient/{id}' for self, or 'RelatedPerson/{id}' for a standalone policy-holder subscriber.
  subscriberReference: string;
}): Coverage {
  const coverage: Coverage = {
    resourceType: 'Coverage',
    status: params.status,
    beneficiary: { type: 'Patient', reference: `Patient/${params.patientId}` },
    subscriber: { reference: params.subscriberReference },
    subscriberId: params.memberId,
    payor: [],
  };
  applyInsuranceTypeToCoverage(coverage, params.insuranceType);
  setCoveragePayer(coverage, params.payerOrg, params.memberId);
  setCoverageRelationship(coverage, params.relationship);
  return coverage;
}

// Resolve a single payer Organization from an Oystehr RCM payer id.
export async function getPayerOrgById(oystehr: Oystehr, payerId: string): Promise<Organization> {
  return oystehr.rcm.getPayerByUrl({ url: getPayerUrl(payerId) });
}

// Account type + priority an insurance type maps to. primary/secondary share the patient billing
// account (PBILLACCT, priority 1/2); workersComp lives in its own account (WCOMPACCT, priority 1).
const ACCOUNT_PLACEMENT: Record<BillingInsuranceType, { type: Account['type']; code: string; priority: number }> = {
  primary: { type: PATIENT_BILLING_ACCOUNT_TYPE, code: 'PBILLACCT', priority: 1 },
  secondary: { type: PATIENT_BILLING_ACCOUNT_TYPE, code: 'PBILLACCT', priority: 2 },
  workersComp: { type: WORKERS_COMP_ACCOUNT_TYPE, code: 'WCOMPACCT', priority: 1 },
};

function accountMatchesCode(account: Account, code: string): boolean {
  return account.type?.coding?.some((c) => c.system === ACCOUNT_TYPE_CODE_SYSTEM && c.code === code) ?? false;
}

async function getPatientAccounts(oystehr: Oystehr, patientId: string): Promise<Account[]> {
  const result = await oystehr.fhir.search<Account>({
    resourceType: 'Account',
    params: [{ name: 'subject', value: `Patient/${patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
  });
  return result.unbundle();
}

// The patient's billing Account (type PBILLACCT), if one exists.
export async function getPatientBillingAccount(oystehr: Oystehr, patientId: string): Promise<Account | undefined> {
  return (await getPatientAccounts(oystehr, patientId)).find((acc) => accountMatchesCode(acc, 'PBILLACCT'));
}

// The patient's workers-comp Account (type WCOMPACCT), if one exists.
export async function getPatientWorkersCompAccount(oystehr: Oystehr, patientId: string): Promise<Account | undefined> {
  return (await getPatientAccounts(oystehr, patientId)).find((acc) => accountMatchesCode(acc, 'WCOMPACCT'));
}

// Determine a coverage's insurance type from the patient's accounts, falling back to Coverage markers.
export function getCoverageInsuranceType(
  coverage: Coverage,
  pbillAccount?: Account,
  wcompAccount?: Account
): BillingInsuranceType | undefined {
  const ref = `Coverage/${coverage.id}`;
  if (wcompAccount?.coverage?.some((c) => c.coverage?.reference === ref)) return 'workersComp';
  const pbillEntry = pbillAccount?.coverage?.find((c) => c.coverage?.reference === ref);
  if (pbillEntry?.priority === 1) return 'primary';
  if (pbillEntry?.priority === 2) return 'secondary';
  if (
    coverage.type?.coding?.some(
      (c) => c.system === CANDID_PLAN_TYPE_SYSTEM && c.code === WORKERS_COMP_COVERAGE_TYPE_CODE
    )
  )
    return 'workersComp';
  if (coverage.order === 2) return 'secondary';
  if (coverage.order === 1) return 'primary';
  return undefined;
}

// Link a coverage to the account for its insurance type (creating the account if needed).
export async function linkCoverageToAccount(
  oystehr: Oystehr,
  patientId: string,
  coverageId: string,
  insuranceType: BillingInsuranceType
): Promise<void> {
  const placement = ACCOUNT_PLACEMENT[insuranceType];
  const account = (await getPatientAccounts(oystehr, patientId)).find((acc) => accountMatchesCode(acc, placement.code));
  const ref = `Coverage/${coverageId}`;
  if (!account) {
    await oystehr.fhir.create<Account>({
      resourceType: 'Account',
      status: 'active',
      type: { ...placement.type },
      subject: [{ reference: `Patient/${patientId}` }],
      coverage: [{ coverage: { reference: ref }, priority: placement.priority }],
    });
    return;
  }
  // Replace whatever held this priority (and any stale reference to this coverage) with the new link.
  const coverage = (account.coverage ?? []).filter(
    (c) => c.priority !== placement.priority && c.coverage?.reference !== ref
  );
  coverage.push({ coverage: { reference: ref }, priority: placement.priority });
  account.coverage = coverage.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  await oystehr.fhir.update<Account>(account);
}

// Remove a coverage's link from any of the patient's accounts.
export async function unlinkCoverageFromAccount(
  oystehr: Oystehr,
  patientId: string,
  coverageId: string
): Promise<void> {
  const accounts = await getPatientAccounts(oystehr, patientId);
  const ref = `Coverage/${coverageId}`;
  await Promise.all(
    accounts.map(async (account) => {
      if (!account.coverage?.length) return;
      const remaining = account.coverage.filter((c) => c.coverage?.reference !== ref);
      if (remaining.length === account.coverage.length) return;
      account.coverage = remaining;
      await oystehr.fhir.update<Account>(account);
    })
  );
}

const INSURANCE_TYPE_LABELS: Record<BillingInsuranceType, string> = {
  primary: 'primary',
  secondary: 'secondary',
  workersComp: "workers' comp",
};

export function coverageInsuranceTypeLabel(insuranceType: BillingInsuranceType): string {
  return INSURANCE_TYPE_LABELS[insuranceType];
}

// Find an active (non-cancelled) coverage already assigned to the given insurance type for the patient.
export async function findCoverageOfType(
  oystehr: Oystehr,
  patientId: string,
  insuranceType: BillingInsuranceType,
  excludeCoverageId?: string
): Promise<Coverage | undefined> {
  const [response, pbillAccount, wcompAccount] = await Promise.all([
    oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: 'beneficiary', value: `Patient/${patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
    }),
    getPatientBillingAccount(oystehr, patientId),
    getPatientWorkersCompAccount(oystehr, patientId),
  ]);

  return response.unbundle().find((cov) => {
    if (cov.id === excludeCoverageId || cov.status === 'cancelled') return false;
    return getCoverageInsuranceType(cov, pbillAccount, wcompAccount) === insuranceType;
  });
}
