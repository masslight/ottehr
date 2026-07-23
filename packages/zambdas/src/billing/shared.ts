import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, OystehrConfig } from '@oystehr/sdk';
import {
  Account,
  Address,
  Basic,
  ChargeItemDefinition,
  Claim,
  Coding,
  Coverage,
  FhirResource,
  Identifier,
  List,
  Location,
  Organization,
  Patient,
  PaymentNotice,
  PaymentReconciliation,
  Person,
  Practitioner,
  Provenance,
  RelatedPerson,
  Resource,
  Task,
} from 'fhir/r4b';
import {
  ACCOUNT_TYPE_CODE_SYSTEM,
  AR_STAGE,
  BILLING_INSURANCE_TYPE_LABELS,
  BILLING_RESOURCE_TAG,
  BillingInsuranceType,
  BillingPolicyHolderInput,
  BillingProviderOption,
  BillingRule,
  BillingSubscriberRelationship,
  buildCoverageSubscriberRelatedPerson,
  ChargeItemDefinitionDefault,
  ChargeItemDefinitionType,
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusFieldKey,
  ClaimStatusValues,
  claimStatusValuesToTags,
  CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  CODE_SYSTEM_COVERAGE_CLASS,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  convertFhirNameToDisplayName,
  createCoverageMemberIdentifier,
  FHIR_IDENTIFIER_CLIA,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_SYSTEM,
  FHIR_RESOURCE_NOT_FOUND,
  getClaimStatusFieldValue,
  getClaimStatusValues,
  getNPI,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getPayerId,
  getPayerUrl,
  getResourcesFromBatchInlineRequests,
  getSecret,
  getSubscriberRelationshipCodeableConcept,
  getTaxID,
  INVALID_INPUT_ERROR,
  isPayerUrl,
  isValidClaimStatusValue,
  isValidUUID,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RulesEngineType,
  Secrets,
  SecretsKeys,
  setCoveragePlanType,
  withArStageInitialization,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { sendErrors } from '../shared';
import { RULES_ENGINE_FHIR, RULES_ENGINE_TAG_SYSTEM } from './rules-engine/constants';
import { buildRulesEngineKickoffTask, listToRules } from './rules-engine/serialization';

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

export const BILLING_WORKING_COPY_TAG = {
  system: 'https://fhir.ottehr.com/billing/resource-type',
  code: 'billing-working-copy',
};

export const CURRENT_STATUS_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/current-status';

// TODO: this function has fallback chain so it is hard to return enum and we don't have standardized status codes yet
export function getClaimStatus(claim: Claim): string {
  return claim.meta?.tag?.find((t) => t.system === CURRENT_STATUS_TAG_SYSTEM)?.code ?? claim.status ?? 'unknown';
}

export function assertValidClaimStatusField(field: ClaimStatusFieldKey, value: string | null): string {
  const resolved = value ?? '';
  if (!isValidClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY[field], resolved)) {
    throw INVALID_INPUT_ERROR(`Invalid value "${resolved}" for claim status field "${field}"`);
  }
  return resolved;
}

// The claim's full meta.tag array with one status field changed: current status values plus the
// update (AR Stage entry runs the same stage-initialization rule used at claim creation), rebuilt
// while preserving every non-status tag. Committing (with its history record) lives in
// provenance.ts#applyClaimStatusField.
export function buildUpdatedClaimStatusTags(claim: Claim, field: ClaimStatusFieldKey, value: string): Coding[] {
  const values: ClaimStatusValues = { ...getClaimStatusValues(claim), [field]: value };
  const updatedValues = field === 'arStage' ? withArStageInitialization(values) : values;

  const statusSystems = new Set(CLAIM_STATUS_FIELDS.map((f) => f.system));
  return [
    ...(claim.meta?.tag ?? []).filter((t) => !t.system || !statusSystems.has(t.system)),
    ...claimStatusValuesToTags(updatedValues),
  ];
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

// Payer display string used across billing: "Name (Payer ID)".
export function payerDisplay(org: Organization | undefined): string | undefined {
  if (!org) return undefined;
  const name = org.name ?? '';
  const payerId = getPayerId(org) ?? '';
  if (name && payerId) return `${name} (${payerId})`;
  return name || payerId || undefined;
}

// Provider role: one tag system  (a provider can bill and/or render).
export const PROVIDER_ROLE_TAG = 'https://fhir.ottehr.com/billing/provider-role';
export const PROVIDER_ROLE_BILLING = 'billing';
export const PROVIDER_ROLE_RENDERING = 'rendering';
export const LICENSE_TAG = 'https://fhir.ottehr.com/billing/license-type';
// Stripe connected account whose payments belong to this billing provider, one account per TIN
export const STRIPE_ACCOUNT_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/billing/stripe-account-id';

export const CHARGE_ITEM_DEFINITION_TYPE_SYSTEM = 'https://fhir.ottehr.com/billing/charge-item-definition-type';
export const CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM = 'https://fhir.ottehr.com/billing/charge-item-definition-default';

export const SOURCE_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/billing/source-resource';
export const ERA_CHECK_SYSTEM = 'https://identifiers.fhir.oystehr.com/era-check-number';
// CLP02 claim status code from the ERA, stamped on ClaimResponses by both Oystehr converters
export const ERA_STATUS_CODE_EXTENSION = 'https://extensions.fhir.oystehr.com/era-status-code';
// Oystehr emits one Provenance per ERA (activity era-processing) whose targets are all resources
// created from that ERA — the PaymentReconciliation and its ClaimResponses. This is how a single
// ERA's resources are linked to each other.
export const PROVENANCE_ACTIVITY_TYPE_SYSTEM = 'http://hl7.org/fhir/ValueSet/provenance-activity-type';
export const ERA_PROCESSING_ACTIVITY_CODE = 'era-processing';

export function isEraProcessingProvenance(provenance: Pick<Provenance, 'activity'>): boolean {
  return provenance.activity?.coding?.some((coding) => coding.code === ERA_PROCESSING_ACTIVITY_CODE) ?? false;
}

// Claim.MD stamps the check number as a searchable identifier; process-era only sets
// paymentIdentifier.
export function getEraCheckNumber(
  pr: Pick<PaymentReconciliation, 'identifier' | 'paymentIdentifier'>
): string | undefined {
  return pr.identifier?.find((id) => id.system === ERA_CHECK_SYSTEM)?.value ?? pr.paymentIdentifier?.value;
}

export const TAG_CODE_SYSTEM = 'https://fhir.ottehr.com/billing/tag';
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
// List pages (active search): also exclude working copies
// Autocomplete dropdowns (Create Claim, etc.): never include working copies
export const EXCLUDE_WORKING_COPIES_PARAMS = [
  { name: '_tag:not', value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}` },
];

export function createBillingClient(
  token: string,
  secrets: Secrets | null,
  overrides?: Partial<OystehrConfig>
): Oystehr {
  return new Oystehr({
    accessToken: token,
    services: {
      fhirApiUrl: getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, ''),
      projectApiUrl: getSecret(SecretsKeys.PROJECT_API, secrets),
    },
    ...overrides,
    workspaceTag: BILLING_RESOURCE_TAG,
  });
}

// ERA resources are untagged by Oystehr
export function createEraReadClient(token: string, secrets: Secrets | null): Oystehr {
  return new Oystehr({
    accessToken: token,
    services: {
      fhirApiUrl: getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, ''),
      projectApiUrl: getSecret(SecretsKeys.PROJECT_API, secrets),
    },
  });
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

// An engine's singleton rules List (undefined when no rules have been configured for it yet).
export async function findRulesEngineList(oystehr: Oystehr, engine: RulesEngineType): Promise<List | undefined> {
  const result = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: '_tag', value: `${RULES_ENGINE_TAG_SYSTEM}|${RULES_ENGINE_FHIR[engine].listCode}` }],
  });
  return result.unbundle()[0];
}

// listToRules with malformed-rule observability: each unparseable rule (returned as a disabled
// placeholder) is also reported to Sentry, with the rule's identity as event tags.
export async function listToRulesReportingMalformed(list: List, env: string): Promise<BillingRule[]> {
  const failures: { error: unknown; tags: Record<string, string> }[] = [];
  const rules = listToRules(list, (error, { ruleId, ruleName }) =>
    failures.push({ error, tags: { ruleId, ruleName } })
  );
  await Promise.all(failures.map(({ error, tags }) => sendErrors(error, env, tags)));
  return rules;
}

/**
 * The rules engine responsible for a claim, decided by its AR Stage:
 * - Insurance Payer AR -> Claim Submission Rules
 * - Non-insurance Payer AR -> Non-Insurance Payer Pre-Invoice Rules
 * - Patient AR, self-pay only (no real coverage on the claim) -> Patient AR Pre-Invoice Rules
 * Undefined when no engine applies (no AR Stage, or Patient AR with insurance coverage).
 *
 * An engine runs automatically only when a claim is created in its stage. Changing an existing
 * claim's AR Stage never runs an engine — set-billing-claim-status holds the claim instead, and the
 * biller runs the rules explicitly (Submit claim / Prepare for invoice).
 */
export function determineRulesEngineForClaim(claim: Claim): RulesEngineType | undefined {
  const arStage = getClaimStatusFieldValue(claim, CLAIM_STATUS_FIELDS_BY_KEY.arStage);
  if (arStage === AR_STAGE.insurancePayer) return 'claim-submission';
  if (arStage === AR_STAGE.nonInsurancePayer) return 'non-insurance-payer-pre-invoice';
  if (arStage === AR_STAGE.patient && !claimHasRealCoverage(claim.insurance)) return 'patient-ar-pre-invoice';
  return undefined;
}

// Enqueue a rules engine for a claim; a Subscription runs it asynchronously. The claim is already
// committed when this runs, so a kickoff failure must not fail the request (a retry would create a
// duplicate claim) — that is why the catch lives here rather than in the callers: the failure is
// logged and reported to Sentry, and the engine can be run on demand via run-billing-rules-engine.
export async function kickOffRulesEngine(
  oystehr: Oystehr,
  engine: RulesEngineType,
  claimId: string,
  secrets: Secrets | null
): Promise<void> {
  // Resolved before the try so the best-effort catch cannot itself throw on a missing secret.
  const env = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  try {
    await oystehr.fhir.create<Task>(buildRulesEngineKickoffTask(engine, claimId));
  } catch (error) {
    console.error(`Failed to enqueue ${engine} rules-engine Task for Claim/${claimId}:`, error);
    await sendErrors(error, env, { claimId, engine });
  }
}

// The claim plus the working-copy resources it references, resolved from the claim's own references.
// Shared by the claim detail endpoint and the rules engine so "what makes up a claim" is fetched one
// way. Coverages are ordered focal-first (the focal entry is the authoritative primary).
export interface ClaimGraph {
  claim: Claim;
  patient?: Patient;
  billingProvider?: Practitioner | Organization;
  serviceFacility?: Location;
  coverages: Coverage[];
  renderingProvider?: Practitioner | Organization;
  // Working-copy subscriber RelatedPersons of the fetched coverages.
  subscribers: RelatedPerson[];
}

export async function fetchClaimGraph(oystehr: Oystehr, claimId: string): Promise<ClaimGraph> {
  const bundle = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      { name: '_id', value: claimId },
      { name: '_include', value: 'Claim:patient' },
      { name: '_include', value: 'Claim:provider' },
      { name: '_include', value: 'Claim:facility' },
    ],
  });
  const resources = bundle.unbundle() as Resource[];
  const claim = resources.find((r) => r.resourceType === 'Claim' && r.id === claimId) as Claim | undefined;
  if (!claim) throw FHIR_RESOURCE_NOT_FOUND('Claim');

  const patient = findRef<Patient>(resources, claim.patient?.reference);
  const billingProvider = findRef<Practitioner | Organization>(resources, claim.provider?.reference);
  const serviceFacility = findRef<Location>(resources, claim.facility?.reference);

  // Coverages (with their subscribers) and the rendering provider live behind references the
  // initial _include can't follow, so they are fetched in one follow-up batch.
  const coverageRefs = [...sortClaimInsurance(claim)]
    .sort((a, b) => (b.focal ? 1 : 0) - (a.focal ? 1 : 0))
    .map((entry) => entry.coverage?.reference)
    .filter((ref): ref is string => !!ref && ref.startsWith('Coverage/'));
  const renderingRef = claim.careTeam?.[0]?.provider?.reference;

  const queries = coverageRefs.map(
    (ref) => `/Coverage?_id=${ref.replace('Coverage/', '')}&_include=Coverage:subscriber`
  );
  if (renderingRef && (renderingRef.startsWith('Practitioner/') || renderingRef.startsWith('Organization/'))) {
    const [type, id] = renderingRef.split('/');
    queries.push(`/${type}?_id=${id}`);
  }
  const followUp = queries.length ? await getResourcesFromBatchInlineRequests(oystehr, queries) : [];

  const coverages = coverageRefs
    .map((ref) => followUp.find((r) => r.resourceType === 'Coverage' && r.id === ref.replace('Coverage/', '')))
    .filter((c): c is Coverage => !!c);
  const renderingId = renderingRef?.split('/')[1];
  const renderingProvider = renderingId
    ? (followUp.find(
        (r) => r.id === renderingId && (r.resourceType === 'Practitioner' || r.resourceType === 'Organization')
      ) as Practitioner | Organization | undefined)
    : undefined;
  const subscribers = followUp.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson');

  return { claim, patient, billingProvider, serviceFacility, coverages, renderingProvider, subscribers };
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
    resource.identifier?.find(
      (id) =>
        id.type?.coding?.some(
          (c) => c.system === CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE && c.code === FHIR_IDENTIFIER_CODE_TAXONOMY
        )
    )?.value ?? ''
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
    !!id.type?.coding?.some(
      (tc) => tc.system === CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE && tc.code === FHIR_IDENTIFIER_CODE_TAXONOMY
    );
  const identifier = resource.identifier ?? [];
  const existing = identifier.find(isTaxonomy);
  if (taxonomyCode) {
    if (existing) existing.value = taxonomyCode;
    else {
      identifier.push({
        type: {
          coding: [{ system: CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE, code: FHIR_IDENTIFIER_CODE_TAXONOMY }],
        },
        value: taxonomyCode,
      });
    }
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => !isTaxonomy(id));
  }
}

export function setClia(resource: Location, clia: string | null): void {
  const identifier = resource.identifier ?? [];
  const existing = identifier.find((id) => id.system === FHIR_IDENTIFIER_CLIA);
  if (clia) {
    if (existing) existing.value = clia;
    else identifier.push({ system: FHIR_IDENTIFIER_CLIA, value: clia });
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => id.system !== FHIR_IDENTIFIER_CLIA);
  }
}

export function setStripeAccountId(resource: Practitioner | Organization, stripeAccountId: string): void {
  const identifier = resource.identifier ?? [];
  const existing = identifier.find((id) => id.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM);
  if (stripeAccountId) {
    if (existing) existing.value = stripeAccountId;
    else identifier.push({ system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM, value: stripeAccountId });
    resource.identifier = identifier;
  } else if (existing) {
    resource.identifier = identifier.filter((id) => id.system !== STRIPE_ACCOUNT_IDENTIFIER_SYSTEM);
  }
}

export function fhirName(resource?: Patient | Practitioner): string {
  const name = resource?.name?.[0];
  return name ? convertFhirNameToDisplayName(name) : '';
}

// Friendly display name for any resource that can be referenced from a claim (undefined when the
// resource has no usable name, so callers can set Reference.display without empty strings).
export function resourceDisplayName(resource: Resource | undefined): string | undefined {
  if (!resource) return undefined;
  const name =
    resource.resourceType === 'Practitioner' || resource.resourceType === 'Patient'
      ? fhirName(resource as Practitioner | Patient)
      : (resource as Organization | Location).name;
  return name || undefined;
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

export function isWorkingCopy<T extends CopyableBillingResource>(resource: CRT<T>): boolean {
  return (
    resource.meta?.tag?.some(
      (tag) => tag.system === BILLING_WORKING_COPY_TAG.system && tag.code === BILLING_WORKING_COPY_TAG.code
    ) ?? false
  );
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
  // extension carries the CMS place-of-service and timezone, which claim building derives from.
  Location: ['resourceType', 'extension', 'identifier', 'address', 'description', 'name', 'telecom', 'type'],
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

export function getClaimService(claim: Claim): string | undefined {
  const code = claim.meta?.tag?.find((c) => c.system === CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM)?.code;
  if (!code) {
    return undefined;
  }
  return code;
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
  planType?: string;
  relationship: BillingSubscriberRelationship;
  // 'Patient/{id}' for self, or 'RelatedPerson/{id}' for a standalone policy-holder subscriber.
  subscriberReference: string;
}): Coverage {
  let coverage: Coverage = {
    resourceType: 'Coverage',
    status: params.status,
    beneficiary: { type: 'Patient', reference: `Patient/${params.patientId}` },
    subscriber: { reference: params.subscriberReference },
    subscriberId: params.memberId,
    payor: [],
  };
  setCoveragePayer(coverage, params.payerOrg, params.memberId);
  setCoverageRelationship(coverage, params.relationship);
  if (params.planType) {
    coverage = setCoveragePlanType(coverage, params.planType);
  }
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

export function getTypeForChargeItemDefinition(cid: ChargeItemDefinition): ChargeItemDefinitionType {
  const typeCode = cid.meta?.tag?.find((t) => t.system === CHARGE_ITEM_DEFINITION_TYPE_SYSTEM)?.code;
  const typeValue: ChargeItemDefinitionType | undefined =
    typeCode && ['charge-master', 'fee-schedule'].includes(typeCode)
      ? (typeCode as ChargeItemDefinitionType)
      : undefined;
  if (!typeValue) {
    throw INVALID_INPUT_ERROR(`ChargeItemDefinition ${cid.id} does not have a valid type`);
  }
  return typeValue;
}

export function getDefaultSettingForChargeItemDefinition(
  cid: ChargeItemDefinition
): ChargeItemDefinitionDefault | undefined {
  const defaultCode = cid.meta?.tag?.find((t) => t.system === CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM)?.code;
  const defaultValue: ChargeItemDefinitionDefault | undefined =
    defaultCode && ['insurance', 'self-pay'].includes(defaultCode)
      ? (defaultCode as 'insurance' | 'self-pay')
      : undefined;
  return defaultValue;
}

export async function tagEraResources({
  oystehr,
  resources,
}: {
  oystehr: Oystehr;
  resources: FhirResource[];
}): Promise<number> {
  const untagged = new Map<string, FhirResource>();
  for (const resource of resources) {
    if (!resource.id || hasTag(resource, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)) continue;
    untagged.set(`${resource.resourceType}/${resource.id}`, resource);
  }
  if (untagged.size === 0) return 0;
  const requests = [...untagged.values()].map((resource) =>
    getPatchBinary({
      resourceType: resource.resourceType,
      resourceId: resource.id!,
      patchOperations: [getPatchOperationForNewMetaTag(resource, BILLING_RESOURCE_TAG)],
    })
  );
  await oystehr.fhir.transaction({ requests });
  return untagged.size;
}

// Links notices the stripe webhook stored before the claim existed. Oystehr matches
// request:identifier by value only, the system|value form returns nothing.
export async function reconcilePaymentNoticesForClaim(oystehr: Oystehr, claim: Claim): Promise<void> {
  const encounterId = claim.identifier?.find((i) => i.system === ottehrIdentifierSystem('claim-encounter-id'))?.value;
  if (!claim.id || !encounterId) return;

  const notices = (
    await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'request:identifier', value: encounterId }],
    })
  ).unbundle();

  const unlinked = notices.filter((n) => n.id && !n.request?.reference);
  if (unlinked.length === 0) return;

  const result = await oystehr.fhir.batch({
    requests: unlinked.map((n) =>
      getPatchBinary({
        resourceType: 'PaymentNotice',
        resourceId: n.id!,
        patchOperations: [{ op: 'add', path: '/request/reference', value: `Claim/${claim.id}` }],
      })
    ),
  });
  const failed = (result.entry ?? []).filter((e) => e.response?.outcome?.id !== 'ok');
  if (failed.length > 0) {
    console.warn(`reconcilePaymentNoticesForClaim: ${failed.length} of ${unlinked.length} patches failed`);
  }
  console.log(`Linked ${unlinked.length - failed.length} PaymentNotice(s) to Claim/${claim.id}`);
}

export function mapProvider(resource: Practitioner | Organization): BillingProviderOption {
  const addr = resource.address?.[0];
  const common = {
    id: resource.id ?? '',
    npi: getNPI(resource) ?? '',
    taxonomyCode:
      resource.identifier?.find(
        (id) =>
          id.type?.coding?.some(
            (c) => c.system === CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE && c.code === FHIR_IDENTIFIER_CODE_TAXONOMY
          )
      )?.value ?? '',
    licenseType: getTag(resource, LICENSE_TAG),
    taxId: getTaxID(resource) ?? '',
    address: formatAddress(addr),
    addressParts: toAddressParts(addr),
    renders: hasTag(resource, PROVIDER_ROLE_TAG, PROVIDER_ROLE_RENDERING),
    bills: hasTag(resource, PROVIDER_ROLE_TAG, PROVIDER_ROLE_BILLING),
    isWorkingCopy: hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code),
  };
  if (resource.resourceType === 'Practitioner') {
    return {
      ...common,
      kind: 'individual',
      name: fhirName(resource),
      firstName: resource.name?.[0]?.given?.join(' ') ?? '',
      lastName: resource.name?.[0]?.family ?? '',
    };
  }
  return {
    ...common,
    kind: 'organization',
    name: resource.name ?? '',
    stripeAccountId: resource.identifier?.find((id) => id.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)?.value ?? '',
  };
}
