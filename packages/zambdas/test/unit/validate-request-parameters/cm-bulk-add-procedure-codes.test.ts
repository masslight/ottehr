import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/cm-bulk-add-procedure-codes/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('cm-bulk-add-procedure-codes - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';
  const validCodes = [{ code: '99213', amount: 150 }];

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, codes: validCodes }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      codes: [{ code: '99213', amount: 150, modifier: undefined }],
      replaceAll: false,
      secrets,
    });
  });

  test('should return replaceAll=true when provided', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, codes: validCodes, replaceAll: true },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.replaceAll).toBe(true);
  });

  test('should handle codes with modifier', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, codes: [{ code: '99213', modifier: '25', amount: 200 }] },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.codes[0].modifier).toBe('25');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ codes: validCodes }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', codes: validCodes }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when codes is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when codes is an empty array', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, codes: [] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a code entry is missing code', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, codes: [{ amount: 150 }] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a code entry amount is not a number', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, codes: [{ code: '99213', amount: 'not-a-number' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
