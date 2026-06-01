import Oystehr from '@oystehr/sdk';
import { Claim, HumanName, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { convertFhirNameToDisplayName, isPayerUrl, Secrets } from 'utils';
import { createOystehrClient } from '../shared/helpers';

export const BILLING_RESOURCE_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-resource',
};

export const BILLING_WORKING_COPY_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-working-copy',
};

export const CURRENT_STATUS_TAG_SYSTEM = 'current-status';

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

// Provider role tags
export const RENDERS_TAG = 'https://fhir.ottehr.com/billing/renders-services';
export const BILLS_TAG = 'https://fhir.ottehr.com/billing/bills-services';
export const LICENSE_TAG = 'https://fhir.ottehr.com/billing/license-type';

export const SOURCE_IDENTIFIER_SYSTEM = 'https://ottehr.com/billing/source-resource';
export const ERA_ID_SYSTEM = 'https://identifiers.fhir.oystehr.com/era-id';
export const ERA_CHECK_SYSTEM = 'https://identifiers.fhir.oystehr.com/era-check-number';

export const TAG_CODE_SYSTEM = 'https://ottehr.com/billing/tag';
export const CLAIM_TAG_SYSTEM = 'https://ottehr.com/billing/claim-tag';
export const TAG_DESCRIPTION_URL = 'https://ottehr.com/billing/tag-description';

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

export function getTag(resource: Resource, system: string): string | undefined {
  return resource.meta?.tag?.find((t) => t.system === system)?.code;
}

export function formatAddress(addr?: { line?: string[]; city?: string; state?: string; postalCode?: string }): string {
  if (!addr) return '';
  return [...(addr.line ?? []), addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
}

export function fhirName(resource?: Patient | Practitioner): string {
  const name = resource?.name?.[0];
  return name ? convertFhirNameToDisplayName(name) : '';
}

// Clone a billing resource into a working copy: strips id, tags it, adds source identifier.
export function prepareWorkingCopy<T extends Resource>(resource: T, originalId: string): T {
  const copy: T & { identifier?: { system: string; value: string }[] } = structuredClone(resource);
  delete copy.id;
  copy.meta = { tag: [BILLING_WORKING_COPY_TAG] };
  const existing = (copy.identifier ?? []).filter((id) => id.system !== SOURCE_IDENTIFIER_SYSTEM);
  copy.identifier = [
    ...existing,
    { system: SOURCE_IDENTIFIER_SYSTEM, value: `${resource.resourceType}/${originalId}` },
  ];
  return copy;
}

// Resolve FHIR reference like "Patient/uuid-12345" from resource array.
export function findRef<T extends Resource>(resources: Resource[], reference?: string): T | undefined {
  if (!reference) return undefined;
  const id = reference.includes('/') ? reference.split('/')[1] : reference;
  return resources.find((r) => r.id === id) as T | undefined;
}

// Apply first/last name overrides to a Patient or Practitioner.
export function applyNameOverrides<T extends { name?: HumanName[] }>(
  resource: T,
  overrides?: { firstName?: string; lastName?: string }
): T {
  if (!overrides) return resource;
  const copy = structuredClone(resource);
  if (!copy.name) copy.name = [{}];
  if (overrides.firstName !== undefined) copy.name[0].given = [overrides.firstName];
  if (overrides.lastName !== undefined) copy.name[0].family = overrides.lastName;
  return copy;
}
