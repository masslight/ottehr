import { describe, expect, test } from 'vitest';
import { DesignateChargeMasterEntryBodySchema } from '../../../src/rcm/charge-masters/designate-charge-master-entry/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('designate-charge-master-entry - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const validChargeMasterId = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for default-insurance designation', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, designation: 'default-insurance' },
      { secrets }
    );
    const result = validateWithSchema(DesignateChargeMasterEntryBodySchema, input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      designation: 'default-insurance',
      secrets,
    });
  });

  test('should return validated params for self-pay designation', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId, designation: 'self-pay' }, { secrets });
    const result = validateWithSchema(DesignateChargeMasterEntryBodySchema, input);
    expect(result).toEqual({
      chargeMasterId: validChargeMasterId,
      designation: 'self-pay',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateWithSchema(DesignateChargeMasterEntryBodySchema, input)).toThrow();
  });

  test('should throw when chargeMasterId is missing', () => {
    const input = createMockZambdaInput({ designation: 'self-pay' }, { secrets });
    expect(() => validateWithSchema(DesignateChargeMasterEntryBodySchema, input)).toThrow();
  });

  test('should throw when chargeMasterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ chargeMasterId: 'not-a-uuid', designation: 'self-pay' }, { secrets });
    expect(() => validateWithSchema(DesignateChargeMasterEntryBodySchema, input)).toThrow();
  });

  test('should throw when designation is missing', () => {
    const input = createMockZambdaInput({ chargeMasterId: validChargeMasterId }, { secrets });
    expect(() => validateWithSchema(DesignateChargeMasterEntryBodySchema, input)).toThrow();
  });

  test('should throw when designation is an invalid enum value', () => {
    const input = createMockZambdaInput(
      { chargeMasterId: validChargeMasterId, designation: 'unknown-designation' },
      { secrets }
    );
    expect(() => validateWithSchema(DesignateChargeMasterEntryBodySchema, input)).toThrow();
  });
});
