import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/payments/get-stripe-account-info/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-stripe-account-info - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ stripeAccountId: 'acct_1234567890abcdef' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      stripeAccountId: 'acct_1234567890abcdef',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when stripeAccountId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when stripeAccountId is an empty string', () => {
    const input = createMockZambdaInput({ stripeAccountId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when stripeAccountId is not a string', () => {
    const input = createMockZambdaInput({ stripeAccountId: 12345 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
