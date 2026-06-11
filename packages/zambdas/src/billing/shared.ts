import Oystehr from '@oystehr/sdk';
import {
  Address,
  Claim,
  HumanName,
  Identifier,
  Location,
  Organization,
  Patient,
  Practitioner,
  Resource,
} from 'fhir/r4b';
import {
  convertFhirNameToDisplayName,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_CODE_TAXONOMY,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  isPayerUrl,
  Secrets,
} from 'utils';
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

// Provider role: one tag system  (a provider can bill and/or render).
export const PROVIDER_ROLE_TAG = 'https://fhir.ottehr.com/billing/provider-role';
export const PROVIDER_ROLE_BILLING = 'billing';
export const PROVIDER_ROLE_RENDERING = 'rendering';
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
