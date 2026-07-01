import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/charge-masters/designate-charge-master-entry/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('designate-charge-master-entry - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for default-insurance designation', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, designation: 'default-insurance' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      designation: 'default-insurance',
      secrets,
    });
  });

  test('should return validated params for self-pay designation', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, designation: 'self-pay' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      designation: 'self-pay',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ designation: 'self-pay' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', designation: 'self-pay' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when designation is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when designation is an invalid enum value', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, designation: 'unknown-designation' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
