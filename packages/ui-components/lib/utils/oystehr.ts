import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { BILLING_RESOURCE_TAG } from 'utils';

export function createClinicalOystehrClient(token?: string, overrides?: Partial<OystehrConfig>): Oystehr {
  return new Oystehr({
    accessToken: token,
    services: {
      fhirApiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
      projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
      zambdaApiUrl:
        import.meta.env.VITE_APP_IS_LOCAL === 'true'
          ? import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL
          : import.meta.env.VITE_APP_PROJECT_API_URL,
    },
    projectId: import.meta.env.VITE_APP_PROJECT_ID,
    ...overrides,
    ignoreTags: [...(overrides?.ignoreTags ?? []), BILLING_RESOURCE_TAG],
  });
}
