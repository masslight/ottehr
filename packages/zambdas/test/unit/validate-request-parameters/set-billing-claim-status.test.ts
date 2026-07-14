import { randomUUID } from 'crypto';
import { AR_STAGE } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/billing/set-billing-claim-status/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('set-billing-claim-status - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const claimId = randomUUID();

  test('returns validated params for a valid AR Stage update', () => {
    const input = createMockZambdaInput({ claimId, field: 'arStage', value: AR_STAGE.insurancePayer }, { secrets });
    expect(validateRequestParameters(input)).toEqual({
      claimId,
      field: 'arStage',
      value: AR_STAGE.insurancePayer,
      secrets,
    });
  });

  test('allows clearing a field with a null value', () => {
    const input = createMockZambdaInput({ claimId, field: 'insuranceArStatus', value: null }, { secrets });
    expect(validateRequestParameters(input).value).toBeNull();
  });

  test('allows omitting the value', () => {
    const input = createMockZambdaInput({ claimId, field: 'insuranceArStatus' }, { secrets });
    expect(validateRequestParameters(input).field).toBe('insuranceArStatus');
  });

  test('throws when the value is not a valid option for the field', () => {
    const input = createMockZambdaInput({ claimId, field: 'arStage', value: 'not-a-stage' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when the value belongs to a different field', () => {
    // 'created' is valid for insuranceArStatus but not for arStage.
    const input = createMockZambdaInput({ claimId, field: 'arStage', value: 'created' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws on an unknown field key', () => {
    const input = createMockZambdaInput({ claimId, field: 'bogusField', value: AR_STAGE.patient }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when claimId is missing', () => {
    const input = createMockZambdaInput({ field: 'arStage', value: AR_STAGE.patient }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when the body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
