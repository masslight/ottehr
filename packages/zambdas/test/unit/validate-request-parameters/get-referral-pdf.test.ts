import { GetReferralPdfInputSchema } from 'utils/lib/types/api/referrals/referrals.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('get-referral-pdf - validateWithSchema', () => {
  const secrets = createMockSecrets();

  test('returns the referral id and secrets', () => {
    expect(
      validateWithSchema(GetReferralPdfInputSchema, createMockZambdaInput({ referralId: VALID_UUID }, { secrets }))
    ).toEqual({ referralId: VALID_UUID, secrets });
  });

  test('rejects a referral id that is not a uuid', () => {
    expect(() =>
      validateWithSchema(GetReferralPdfInputSchema, createMockZambdaInput({ referralId: 'nope' }, { secrets }))
    ).toThrow();
  });

  test('answers a missing body with the standard missing-body error', () => {
    expect(() => validateWithSchema(GetReferralPdfInputSchema, createMockZambdaInput(null, { secrets }))).toThrow(
      expect.objectContaining(MISSING_REQUEST_BODY)
    );
  });

  test('answers missing secrets with the standard missing-secrets error', () => {
    expect(() =>
      validateWithSchema(
        GetReferralPdfInputSchema,
        createMockZambdaInput({ referralId: VALID_UUID }, { secrets: null })
      )
    ).toThrow(expect.objectContaining(MISSING_REQUEST_SECRETS));
  });
});
