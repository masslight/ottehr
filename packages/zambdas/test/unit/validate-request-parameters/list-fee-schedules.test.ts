import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/fee-schedules/list-fee-schedules/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('list-fee-schedules - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return secrets for a valid request', () => {
    const input = createMockZambdaInput(null, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ secrets });
  });

  test('should return secrets even when body is provided', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ secrets });
  });
});
