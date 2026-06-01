import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-or-create-visit-label-pdf/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-or-create-visit-label-pdf - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ encounterId: 'encounter-123' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      encounterId: 'encounter-123',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput({ encounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
