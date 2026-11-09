import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/get-charge-item-definition-version/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-charge-item-definition-version - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const resourceId = '550e8400-e29b-41d4-a716-446655440000';
  const versionId = 'b4ae842a-d549-4568-8cd5-c67327c487f6';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ resourceId, versionId }, { secrets });
    expect(validateRequestParameters(input)).toEqual({ resourceId, versionId, secrets });
  });

  test.each(['resourceId', 'versionId'])('should throw when %s is missing', (field) => {
    const body: Record<string, string> = { resourceId, versionId };
    delete body[field];
    expect(() => validateRequestParameters(createMockZambdaInput(body, { secrets }))).toThrow(field);
  });

  test.each(['resourceId', 'versionId'])('should throw when %s is not a UUID', (field) => {
    const body = { resourceId, versionId, [field]: '../../Patient/123' };
    expect(() => validateRequestParameters(createMockZambdaInput(body, { secrets }))).toThrow();
  });
});
