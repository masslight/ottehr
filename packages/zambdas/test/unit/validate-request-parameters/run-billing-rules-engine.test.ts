import { randomUUID } from 'crypto';
import { MAX_RUN_RULES_ENGINE_CLAIMS } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/billing/run-billing-rules-engine/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('run-billing-rules-engine - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const claimIds = [randomUUID(), randomUUID()];

  test('returns validated params for a list of claim ids', () => {
    const input = createMockZambdaInput({ claimIds }, { secrets });
    expect(validateRequestParameters(input)).toEqual({
      claimIds,
      secrets,
    });
  });

  test('throws when a claim id is empty', () => {
    const input = createMockZambdaInput(
      {
        claimIds: [''],
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
        claimIds: Array.from({ length: MAX_RUN_RULES_ENGINE_CLAIMS + 1 }, () => randomUUID()),
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
