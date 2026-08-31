import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/prebook-get-appointments/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('prebook-get-appointments - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return secrets when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ secrets });
  });

  test('should return validated params for a valid request with empty body', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ patientID: undefined, dateRange: undefined, secrets });
  });

  test('should return validated params for a valid request with patientID', () => {
    const input = createMockZambdaInput({ patientID: VALID_PATIENT_ID }, { secrets });
    const result = validateRequestParameters(input);
    expect(result).toEqual({ patientID: VALID_PATIENT_ID, dateRange: undefined, secrets });
  });

  test('should return validated params for a valid request with dateRange', () => {
    const input = createMockZambdaInput(
      {
        patientID: VALID_PATIENT_ID,
        dateRange: { greaterThan: '2025-01-01T00:00:00Z', lessThan: '2025-12-31T23:59:59Z' },
      },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.dateRange).toEqual({
      greaterThan: '2025-01-01T00:00:00Z',
      lessThan: '2025-12-31T23:59:59Z',
    });
  });

  test('should throw when patientID is not a valid UUID', () => {
    const input = createMockZambdaInput({ patientID: 'not-a-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateRange is missing greaterThan', () => {
    const input = createMockZambdaInput({ dateRange: { lessThan: '2025-12-31T23:59:59Z' } }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when dateRange is missing lessThan', () => {
    const input = createMockZambdaInput({ dateRange: { greaterThan: '2025-01-01T00:00:00Z' } }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
