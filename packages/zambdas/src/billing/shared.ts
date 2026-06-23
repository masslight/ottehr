import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
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
  BILLING_INSURANCE_TYPE_LABELS,
  BillingInsuranceType,
  BillingPolicyHolderInput,
  BillingSubscriberRelationship,
  buildCoverageSubscriberRelatedPerson,
  CODE_SYSTEM_APPOINTMENT_TYPE_CODES,
  CODE_SYSTEM_APPOINTMENT_TYPE_TAG_SYSTEM,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  CODE_SYSTEM_COVERAGE_CLASS,
  convertFhirNameToDisplayName,
  createCoverageMemberIdentifier,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  FHIR_RESOURCE_NOT_FOUND,
  getPayerId,
  getPayerUrl,
  getSubscriberRelationshipCodeableConcept,
  isPayerUrl,
  isValidUUID,
  PATIENT_BILLING_ACCOUNT_TYPE,
  Secrets,
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

// FHIR Claim.insurance has cardinality 1..*, but purely self-pay claims (straight to Patient AR) have no
// real Coverage. We satisfy the cardinality with a stub insurance entry whose coverage is a logical
// reference (identifier only, no literal Coverage/<id> reference). Real coverages always carry
// coverage.reference, so the identifier.system marker unambiguously distinguishes the stub. The read
// endpoints key off coverage.reference, so the stub renders as blank in the UI.
export const NO_COVERAGE_SYSTEM = 'https://fhir.ottehr.com/billing/no-coverage';
export const NO_COVERAGE_DISPLAY = 'No insurance coverage';

type ClaimInsurance = NonNullable<Claim['insurance']>[number];

export function buildNoCoverageStub(): ClaimInsurance {
  return {
    sequence: 1,
    focal: true,
    coverage: {
      identifier: { system: NO_COVERAGE_SYSTEM, value: 'no-coverage' },
      display: NO_COVERAGE_DISPLAY,
    },
  };
}

export function isNoCoverageStub(entry: ClaimInsurance): boolean {
  return entry.coverage?.identifier?.system === NO_COVERAGE_SYSTEM;
}

// True when the claim carries at least one real (non-stub) coverage.
export function claimHasRealCoverage(insurance?: Claim['insurance']): boolean {
  return (insurance ?? []).some((entry) => !isNoCoverageStub(entry));
}

// Enforce the Claim.insurance invariant: strip the stub whenever a real coverage is present, and
// re-insert the stub when no real coverage remains. Real entries are re-sequenced 1..n with the
// first marked focal. Call this from every site that mutates Claim.insurance.
export function ensureClaimInsurance(insurance?: Claim['insurance']): NonNullable<Claim['insurance']> {
  const real = (insurance ?? []).filter((entry) => !isNoCoverageStub(entry));
  if (real.length === 0) return [buildNoCoverageStub()];
  return [...real]
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry, idx) => ({ ...entry, sequence: idx + 1, focal: idx === 0 }));
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

export const CHARGE_ITEM_DEFINITION_TYPE_SYSTEM = 'https://fhir.ottehr.com/billing/charge-item-definition-type';
export const CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM = 'https://fhir.ottehr.com/billing/charge-item-definition-default';

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

// Taxonomy is stored as a ZZ-typed identifier
export function getTaxonomy(resource: Practitioner | Organization): string {
  return (
    resource.identifier?.find((id) => id.type?.coding?.some((c) => c.code === FHIR_IDENTIFIER_CODE_TAXONOMY))?.value ??
    ''
  );
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
  Coverage: [
    'resourceType',
    'status',
    'subscriber',
    'beneficiary',
    'payor',
    'subscriberId',
    'relationship',
    'class',
    'type',
  ],
  Location: ['resourceType', 'identifier', 'address', 'description', 'name', 'telecom', 'type'],
  Organization: ['resourceType', 'identifier', 'active', 'address', 'contact', 'name', 'telecom', 'type'],
  Patient: ['resourceType', 'name', 'active', 'gender', 'address', 'telecom', 'birthDate'],
  Practitioner: [
    'resourceType',
    'identifier',
    'active',
    'address',
    'birthDate',
    'gender',
    'name',
    'qualification',
    'telecom',
  ],
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
// Coverage construction reuses the shared builders in `utils` (buildCoverageSubscriberRelatedPerson,
// getSubscriberRelationshipCodeableConcept) so the billing app and the clinical EHR / harvest stay
// aligned. The one intentional difference: the subscriber RelatedPerson is persisted standalone here
// (so it can be searched), whereas harvest contains it on the Coverage.

function buildPayorReference(payerOrg: Organization): string {
  const payerId = getPayerId(payerOrg);
  if (isValidUUID(payerOrg.id ?? '')) return `Organization/${payerOrg.id}`;
  if (!payerId) throw new Error('payerId unexpectedly missing from payer organization');
  return getPayerUrl(payerId);
}

export function setCoverageRelationship(coverage: Coverage, relationship: BillingSubscriberRelationship): void {
  coverage.relationship = getSubscriberRelationshipCodeableConcept(relationship);
}

// Standalone RelatedPerson policy holder (the coverage subscriber for non-self relationships).
export function buildSubscriberRelatedPerson(
  patientId: string,
  relationship: BillingSubscriberRelationship,
  policyHolder: BillingPolicyHolderInput
): RelatedPerson {
  return buildCoverageSubscriberRelatedPerson(
    patientId,
    { ...policyHolder, address: policyHolder.address ? buildAddress(policyHolder.address) : undefined },
    relationship
  );
}

// Set payor reference + coverage class + member-id identifier from a payer Organization.
export function setCoveragePayer(coverage: Coverage, payerOrg: Organization, memberId: string): void {
  const payerId = getPayerId(payerOrg);
  if (!payerId) throw new Error('payerId unexpectedly missing from payer organization');
  coverage.payor = [{ reference: buildPayorReference(payerOrg) }];
  coverage.class = [
    {
      type: { coding: [{ system: CODE_SYSTEM_COVERAGE_CLASS, code: 'plan' }] },
      value: payerId,
      name: payerOrg.name ?? '',
    },
  ];
  coverage.identifier = [createCoverageMemberIdentifier(memberId, payerOrg)];
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
  setCoveragePayer(coverage, params.payerOrg, params.memberId);
  setCoverageRelationship(coverage, params.relationship);
  return coverage;
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

export async function getPatientAccounts(oystehr: Oystehr, patientId: string): Promise<Account[]> {
  const result = await oystehr.fhir.search<Account>({
    resourceType: 'Account',
    params: [{ name: 'subject', value: `Patient/${patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
  });
  return result.unbundle();
}

// Derive the billing / workers-comp Accounts from an already-fetched list (avoids extra searches).
export function findPatientBillingAccount(accounts: Account[]): Account | undefined {
  return accounts.find((acc) => accountMatchesCode(acc, 'PBILLACCT'));
}

export function findPatientWorkersCompAccount(accounts: Account[]): Account | undefined {
  return accounts.find((acc) => accountMatchesCode(acc, 'WCOMPACCT'));
}

// A coverage's insurance type is determined by which account holds it (PBILLACCT priority 1/2 or the
// workers-comp account) — the same signal create-billing-claim-from-encounter reads.
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
  return undefined;
}

type AccountWriteRequest = BatchInputPostRequest<Account> | BatchInputPutRequest<Account>;

// Transaction request(s) that place `coverageRef` as the given insurance type for the patient,
// removing it from any other account it currently occupies. `coverageRef` may be a real
// `Coverage/{id}` or a `urn:uuid:` placeholder resolved within the same transaction.
export function reconcileAccountsForCoverage(
  accounts: Account[],
  patientId: string,
  coverageRef: string,
  insuranceType: BillingInsuranceType
): AccountWriteRequest[] {
  const placement = ACCOUNT_PLACEMENT[insuranceType];
  const target = accounts.find((acc) => accountMatchesCode(acc, placement.code));
  const requests: AccountWriteRequest[] = [];

  // Drop this coverage from any other account it currently sits in.
  for (const account of accounts) {
    if (account === target) continue;
    if (account.coverage?.some((c) => c.coverage?.reference === coverageRef)) {
      requests.push({
        method: 'PUT',
        url: `Account/${account.id}`,
        resource: { ...account, coverage: account.coverage.filter((c) => c.coverage?.reference !== coverageRef) },
      });
    }
  }

  if (!target) {
    requests.push({
      method: 'POST',
      url: '/Account',
      resource: {
        resourceType: 'Account',
        status: 'active',
        type: { ...placement.type },
        subject: [{ reference: `Patient/${patientId}` }],
        coverage: [{ coverage: { reference: coverageRef }, priority: placement.priority }],
      },
    });
  } else {
    const coverage = (target.coverage ?? []).filter(
      (c) => c.priority !== placement.priority && c.coverage?.reference !== coverageRef
    );
    coverage.push({ coverage: { reference: coverageRef }, priority: placement.priority });
    requests.push({
      method: 'PUT',
      url: `Account/${target.id}`,
      resource: { ...target, coverage: coverage.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)) },
    });
  }
  return requests;
}

// Transaction request(s) removing `coverageRef` from every account that references it.
export function accountUnlinkRequests(accounts: Account[], coverageRef: string): BatchInputPutRequest<Account>[] {
  return accounts
    .filter((acc) => acc.coverage?.some((c) => c.coverage?.reference === coverageRef))
    .map((acc) => ({
      method: 'PUT',
      url: `Account/${acc.id}`,
      resource: { ...acc, coverage: (acc.coverage ?? []).filter((c) => c.coverage?.reference !== coverageRef) },
    }));
}

export function coverageInsuranceTypeLabel(insuranceType: BillingInsuranceType): string {
  return BILLING_INSURANCE_TYPE_LABELS[insuranceType];
}

// Find an active (non-cancelled) coverage already assigned to the given insurance type for the patient.
export async function findCoverageOfType(
  oystehr: Oystehr,
  patientId: string,
  insuranceType: BillingInsuranceType,
  excludeCoverageId?: string
): Promise<Coverage | undefined> {
  const [response, accounts] = await Promise.all([
    oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: 'beneficiary', value: `Patient/${patientId}` }, ...EXCLUDE_WORKING_COPIES_PARAMS],
    }),
    getPatientAccounts(oystehr, patientId),
  ]);
  const pbillAccount = findPatientBillingAccount(accounts);
  const wcompAccount = findPatientWorkersCompAccount(accounts);

  return response.unbundle().find((cov) => {
    if (cov.id === excludeCoverageId || cov.status === 'cancelled') return false;
    return getCoverageInsuranceType(cov, pbillAccount, wcompAccount) === insuranceType;
  });
}

export function chargeItemDefinitionNameToUrl(type: 'charge-master' | 'fee-schedule', name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `urn:uuid:${type}:${slug}`;
}
