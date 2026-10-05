import { randomUUID } from 'crypto';
import { MAX_RUN_RULES_ENGINE_CLAIMS } from 'utils/lib/types/data/billing/rules-engine.schemas';
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
      skipRules: false,
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

  test('returns validated params for valid submission type params', () => {
    expect(
      validateRequestParameters(
        createMockZambdaInput({ claimIds, skipRules: true, submissionType: 'new' }, { secrets })
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'new',
    });
    expect(
      validateRequestParameters(
        createMockZambdaInput({ claimIds, skipRules: false, submissionType: 'new' }, { secrets })
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: false,
      submissionType: 'new',
    });
    expect(
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'correction', payerClaimControlNumber: 'PCCN-12345' },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'correction',
      payerClaimControlNumber: 'PCCN-12345',
    });
    expect(
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'void', payerClaimControlNumber: 'PCCN-12345' },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'void',
      payerClaimControlNumber: 'PCCN-12345',
    });
  });

  test('throws for invalid submission type params', () => {
    // New submissions should not have PCCN
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'new', payerClaimControlNumber: 'PCCN-12345' },
          { secrets }
        )
      )
    ).toThrow();
    // Corrections and voids require PCCN
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'void', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    // Only "new" can be used when skipRules is false
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: false, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          { claimIds, skipRules: false, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
  });
});
