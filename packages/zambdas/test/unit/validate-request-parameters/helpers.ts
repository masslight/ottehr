import { Secrets } from 'utils';
import { ZambdaInput } from '../../../src/shared';

/**
 * Creates a mock ZambdaInput with a JSON-stringified body.
 */
export const createMockZambdaInput = (body: any, overrides?: Partial<ZambdaInput>): ZambdaInput => ({
  body: body != null ? JSON.stringify(body) : body ?? null,
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
  ...overrides,
});

/**
 * Creates a mock secrets object with common keys populated.
 */
export const createMockSecrets = (overrides?: Record<string, string>): Secrets => ({
  PROJECT_API: 'https://project.api',
  ORGANIZATION_ID: 'org-123',
  FHIR_API: 'https://fhir.api',
  ENVIRONMENT: 'testing',
  ...overrides,
});
