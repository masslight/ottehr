import { FAX_LOGS_PAGE_SIZE } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-fax-logs/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-fax-logs - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should apply pagination defaults for an empty request', () => {
    const input = createMockZambdaInput({}, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      pageIndex: 0,
      itemsPerPage: FAX_LOGS_PAGE_SIZE,
      secrets,
    });
  });

  test('should return validated params for a fully filtered request', () => {
    const input = createMockZambdaInput(
      {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        patientName: 'Black',
        visitId: '650e8400-e29b-41d4-a716-446655440000',
        visitDate: '2024-07-29',
        pageIndex: 2,
        itemsPerPage: 25,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      patientName: 'Black',
      visitId: '650e8400-e29b-41d4-a716-446655440000',
      visitDate: '2024-07-29',
      pageIndex: 2,
      itemsPerPage: 25,
      secrets,
    });
  });

  test('should throw when patientId is not a valid UUID', () => {
    const input = createMockZambdaInput({ patientId: 'patient-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when visitId is not a valid UUID', () => {
    const input = createMockZambdaInput({ visitId: 'visit-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when visitDate is not in YYYY-MM-DD format', () => {
    const input = createMockZambdaInput({ visitDate: '07/29/2024' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when pageIndex is negative', () => {
    const input = createMockZambdaInput({ pageIndex: -1 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when itemsPerPage exceeds the maximum', () => {
    const input = createMockZambdaInput({ itemsPerPage: 51 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({}, { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
