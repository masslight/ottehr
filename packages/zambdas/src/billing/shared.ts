import Oystehr from '@oystehr/sdk';
import { Organization, Resource } from 'fhir/r4b';
import { getNPI, Secrets } from 'utils';
import { createOystehrClient } from '../shared/helpers';

export const BILLING_RESOURCE_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-resource',
};

export const BILLING_WORKING_COPY_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-working-copy',
};

// Provider role tags
export const RENDERS_TAG = 'https://fhir.ottehr.com/billing/renders-services';
export const BILLS_TAG = 'https://fhir.ottehr.com/billing/bills-services';
export const LICENSE_TAG = 'https://fhir.ottehr.com/billing/license-type';

export const EXCLUDE_WORKING_COPIES_PARAM = {
  name: '_tag:not',
  value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}`,
};

/**
 * Standard billing client. All billing zambdas use this.
 * workspaceTag ensures we work with only billing resources.
 * Add EXCLUDE_WORKING_COPIES_PARAM to search params when listing originals only.
 */
export function createBillingClient(token: string, secrets: Secrets | null): Oystehr {
  return createOystehrClient(token, secrets, { workspaceTag: BILLING_RESOURCE_TAG });
}

// Payer identifier lookup (ETIN or NIIP)
export function getPayerId(org: Organization): string {
  return (
    org.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'ETIN' || c.code === 'NIIP'))?.value ?? ''
  );
}

export function hasNpiIdentifier(org: Organization): boolean {
  return getNPI(org) != null;
}

// Read a meta tag value by system
export function getTag(resource: Resource, system: string): string | undefined {
  return resource.meta?.tag?.find((t) => t.system === system)?.code;
}

// Format a FHIR address into a single string
export function formatAddress(addr?: { line?: string[]; city?: string; state?: string; postalCode?: string }): string {
  if (!addr) return '';
  return [...(addr.line ?? []), addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
}
