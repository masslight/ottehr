import { randomUUID } from 'crypto';
import { MAX_SUBMIT_BILLING_CLAIMS } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/billing/submit-billing-claim/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('submit-billing-claim - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const claimIds = [randomUUID(), randomUUID()];

  test('returns validated params for a list of claim ids', () => {
    const input = createMockZambdaInput({ claimIds }, { secrets });
    expect(validateRequestParameters(input)).toEqual({
      claimIds,
      secrets,
    });
  });

  test('throws when a claim id is not a uuid', () => {
    const input = createMockZambdaInput(
      {
        claimIds: ['claim-1'],
      },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when claimIds is empty', () => {
    const input = createMockZambdaInput(
      {
        claimIds: [],
      },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when claimIds is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when more than the maximum number of claim ids is provided', () => {
    const input = createMockZambdaInput(
      {
        claimIds: Array.from({ length: MAX_SUBMIT_BILLING_CLAIMS + 1 }, () => randomUUID()),
      },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when the body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
