import { randomUUID } from 'crypto';
import {
  MAX_RUN_RULES_ENGINE_CLAIMS,
  RunBillingRulesEngineInputSchema,
} from 'utils/lib/types/data/billing/rules-engine.schemas';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('run-billing-rules-engine - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const claimIds = [randomUUID(), randomUUID()];

  test('returns validated params for a list of claim ids', () => {
    const input = createMockZambdaInput({ claimIds }, { secrets });
    expect(validateWithSchema(RunBillingRulesEngineInputSchema, input)).toEqual({
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
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when claimIds is empty', () => {
    const input = createMockZambdaInput(
      {
        claimIds: [],
      },
      { secrets }
    );
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when claimIds is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when more than the maximum number of claim ids is provided', () => {
    const input = createMockZambdaInput(
      {
        claimIds: Array.from({ length: MAX_RUN_RULES_ENGINE_CLAIMS + 1 }, () => randomUUID()),
      },
      { secrets }
    );
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when the body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('returns validated params for valid submission type params', () => {
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput({ claimIds, skipRules: true, submissionType: 'new' }, { secrets })
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'new',
    });
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput({ claimIds, skipRules: false, submissionType: 'new' }, { secrets })
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: false,
      submissionType: 'new',
    });
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
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
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
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
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'new', payerClaimControlNumber: 'PCCN-12345' },
          { secrets }
        )
      )
    ).toThrow();
    // Corrections and voids require PCCN
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'void', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    // Only "new" can be used when skipRules is false
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: false, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: false, submissionType: 'correction', payerClaimControlNumber: undefined },
          { secrets }
        )
      )
    ).toThrow();
  });
});
