import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/get-version-history/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-version-history - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validResourceId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ resourceId: validResourceId }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      resourceId: validResourceId,
      secrets,
    });
  });

  test('should throw when resourceId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when resourceId is not a valid UUID', () => {
    const input = createMockZambdaInput({ resourceId: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
