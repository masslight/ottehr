import { describe, expect, test } from 'vitest';
import { GetVisitLabelBodySchema } from '../../../src/ehr/get-or-create-visit-label-pdf/index';
import { validateWithSchema } from '../../../src/shared/validation';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-or-create-visit-label-pdf - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput({ encounterId: '550e8400-e29b-41d4-a716-446655440000' }, { secrets });
    const result = validateWithSchema(GetVisitLabelBodySchema, input);

    expect(result).toEqual({
      encounterId: '550e8400-e29b-41d4-a716-446655440000',
      secrets,
    });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateWithSchema(GetVisitLabelBodySchema, input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({}, { secrets });
    expect(() => validateWithSchema(GetVisitLabelBodySchema, input)).toThrow();
  });

  test('should throw when encounterId is empty string', () => {
    const input = createMockZambdaInput({ encounterId: '' }, { secrets });
    expect(() => validateWithSchema(GetVisitLabelBodySchema, input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ encounterId: 'encounter-123' }, { secrets });
    expect(() => validateWithSchema(GetVisitLabelBodySchema, input)).toThrow();
  });
});
