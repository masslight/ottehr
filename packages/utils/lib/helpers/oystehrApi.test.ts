import { describe, expect, it } from 'vitest';
import { APIErrorCode } from '../types/errors';
import { getApiErrorCode } from './oystehrApi';

describe('getApiErrorCode', () => {
  it('reads a top-level code', () => {
    expect(
      getApiErrorCode({
        code: APIErrorCode.INVALID_INPUT,
        message: 'bad',
      })
    ).toBe(APIErrorCode.INVALID_INPUT);
  });

  it('reads a code nested under output', () => {
    expect(
      getApiErrorCode({
        output: {
          code: APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC,
          message: 'declined',
        },
      })
    ).toBe(APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC);
  });

  it('returns undefined for an error without a code', () => {
    expect(getApiErrorCode(new Error('network'))).toBeUndefined();
    expect(getApiErrorCode(undefined)).toBeUndefined();
  });
});
