import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/delete-fee-schedule/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('delete-fee-schedule - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ id: VALID_ID }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      id: VALID_ID,
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when id is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when id is not a valid UUID', () => {
    const input = createMockZambdaInput({ id: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when id is an empty string', () => {
    const input = createMockZambdaInput({ id: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
