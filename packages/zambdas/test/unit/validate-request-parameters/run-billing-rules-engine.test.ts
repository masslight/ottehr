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
    const input = createMockZambdaInput(
      { claimIds, submissionType: 'new', submissionInsurance: 'primary' },
      { secrets }
    );
    expect(validateWithSchema(RunBillingRulesEngineInputSchema, input)).toEqual({
      claimIds,
      secrets,
      skipRules: false,
      submissionType: 'new',
      submissionInsurance: 'primary',
    });
  });

  test('throws when a claim id is empty', () => {
    const input = createMockZambdaInput(
      { claimIds: [''], submissionType: 'new', submissionInsurance: 'primary' },
      { secrets }
    );
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when claimIds is empty', () => {
    const input = createMockZambdaInput(
      { claimIds: [], submissionType: 'new', submissionInsurance: 'primary' },
      { secrets }
    );
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when claimIds is missing', () => {
    const input = createMockZambdaInput({ submissionType: 'new', submissionInsurance: 'primary' }, { secrets });
    expect(() => validateWithSchema(RunBillingRulesEngineInputSchema, input)).toThrow();
  });

  test('throws when more than the maximum number of claim ids is provided', () => {
    const input = createMockZambdaInput(
      {
        claimIds: Array.from({ length: MAX_RUN_RULES_ENGINE_CLAIMS + 1 }, () => randomUUID()),
        submissionType: 'new',
        submissionInsurance: 'primary',
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
        createMockZambdaInput(
          { claimIds, skipRules: true, submissionType: 'new', submissionInsurance: 'primary' },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'new',
      submissionInsurance: 'primary',
    });
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          { claimIds, skipRules: false, submissionType: 'new', submissionInsurance: 'primary' },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: false,
      submissionType: 'new',
      submissionInsurance: 'primary',
    });
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: true,
            submissionType: 'correction',
            submissionInsurance: 'primary',
            payerClaimControlNumber: 'PCCN-12345',
          },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'correction',
      submissionInsurance: 'primary',
      payerClaimControlNumber: 'PCCN-12345',
    });
    expect(
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: true,
            submissionType: 'void',
            submissionInsurance: 'primary',
            payerClaimControlNumber: 'PCCN-12345',
          },
          { secrets }
        )
      )
    ).toEqual({
      claimIds,
      secrets,
      skipRules: true,
      submissionType: 'void',
      submissionInsurance: 'primary',
      payerClaimControlNumber: 'PCCN-12345',
    });
  });

  test('throws for invalid submission type params', () => {
    // New submissions should not have PCCN
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: true,
            submissionType: 'new',
            submissionInsurance: 'primary',
            payerClaimControlNumber: 'PCCN-12345',
          },
          { secrets }
        )
      )
    ).toThrow();
    // Corrections and voids require PCCN
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: true,
            submissionType: 'correction',
            submissionInsurance: 'primary',
            payerClaimControlNumber: undefined,
          },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: true,
            submissionType: 'void',
            submissionInsurance: 'primary',
            payerClaimControlNumber: undefined,
          },
          { secrets }
        )
      )
    ).toThrow();
    // Only "new" can be used when skipRules is false
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: false,
            submissionType: 'correction',
            submissionInsurance: 'primary',
            payerClaimControlNumber: undefined,
          },
          { secrets }
        )
      )
    ).toThrow();
    expect(() =>
      validateWithSchema(
        RunBillingRulesEngineInputSchema,
        createMockZambdaInput(
          {
            claimIds,
            skipRules: false,
            submissionType: 'correction',
            submissionInsurance: 'primary',
            payerClaimControlNumber: undefined,
          },
          { secrets }
        )
      )
    ).toThrow();
  });
});
