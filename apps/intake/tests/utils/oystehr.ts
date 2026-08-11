import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';

export function createClinicalOystehrClient(token?: string, overrides?: Partial<OystehrConfig>): Oystehr {
  return new Oystehr({
    accessToken: token,
    ...overrides,
    ignoreTags: [...(overrides?.ignoreTags ?? []), BILLING_RESOURCE_TAG],
  });
}
