import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils';
import { createOystehrClient } from '../shared/helpers';

export const BILLING_RESOURCE_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-resource',
};

export const BILLING_WORKING_COPY_TAG = {
  system: 'https://ottehr.com/billing/resource-type',
  code: 'billing-working-copy',
};

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
