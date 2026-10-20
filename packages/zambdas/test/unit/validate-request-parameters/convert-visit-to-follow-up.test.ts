import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/convert-visit-to-follow-up/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('convert-visit-to-follow-up - validateRequestParameters', () => {
  const validBody = {
    encounterId: 'enc-123',
    parentEncounterId: 'enc-parent',
  };
  const secrets = createMockSecrets();

  test('should return validated params', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('enc-123');
    expect(result.parentEncounterId).toBe('enc-parent');
    expect(result.skipPatientDiagnosis).toBeUndefined();
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toEqual(secrets);
  });

  test('should pass through skipPatientDiagnosis when provided', () => {
    const input = createMockZambdaInput({ ...validBody, skipPatientDiagnosis: true }, { secrets });
    expect(validateRequestParameters(input).skipPatientDiagnosis).toBe(true);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is not a valid JSON object', () => {
    const input = createMockZambdaInput(null, { body: '"just a string"', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when secrets are missing', () => {
    const input = createMockZambdaInput(validBody, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({ parentEncounterId: 'enc-parent' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when encounterId is empty', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when encounterId is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, encounterId: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should throw when parentEncounterId is missing', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('parentEncounterId');
  });

  test('should throw when parentEncounterId is empty', () => {
    const input = createMockZambdaInput({ ...validBody, parentEncounterId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('parentEncounterId');
  });

  test('should throw when skipPatientDiagnosis is not a boolean', () => {
    const input = createMockZambdaInput({ ...validBody, skipPatientDiagnosis: 'yes' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('skipPatientDiagnosis');
  });

  test('should throw when the auth token is absent', () => {
    const input = createMockZambdaInput(validBody, { secrets, headers: { Authorization: 'Bearer ' } });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
