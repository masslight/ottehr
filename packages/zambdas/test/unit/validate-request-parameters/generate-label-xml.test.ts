import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/generate-label-xml/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('generate-label-xml - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  describe('visit type', () => {
    test('should return validated params for a visit request', () => {
      const input = createMockZambdaInput({ type: 'visit', encounterId: 'encounter-123' }, { secrets });
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        type: 'visit',
        encounterId: 'encounter-123',
        secrets,
        userToken: 'test-token',
      });
    });

    test('should throw when encounterId is missing for visit type', () => {
      const input = createMockZambdaInput({ type: 'visit' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });
  });

  describe('external-lab type', () => {
    test('should return validated params for an external-lab request', () => {
      const input = createMockZambdaInput(
        { type: 'external-lab', serviceRequestId: 'sr-123', userTimezone: 'America/New_York' },
        { secrets }
      );
      const result = validateRequestParameters(input);

      expect(result).toEqual({
        type: 'external-lab',
        serviceRequestId: 'sr-123',
        userTimezone: 'America/New_York',
        secrets,
        userToken: 'test-token',
      });
    });

    test('should throw when serviceRequestId is missing for external-lab type', () => {
      const input = createMockZambdaInput({ type: 'external-lab', userTimezone: 'America/New_York' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when userTimezone is missing for external-lab type', () => {
      const input = createMockZambdaInput({ type: 'external-lab', serviceRequestId: 'sr-123' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });
  });

  describe('error cases', () => {
    test('should throw when body is missing', () => {
      const input = createMockZambdaInput(null, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when type is invalid', () => {
      const input = createMockZambdaInput({ type: 'invalid', encounterId: 'enc-123' }, { secrets });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should throw when body is invalid JSON', () => {
      const input = createMockZambdaInput(null, {
        secrets,
        body: 'not-json',
      });
      expect(() => validateRequestParameters(input)).toThrow();
    });

    test('should extract bearer token from Authorization header', () => {
      const input = createMockZambdaInput(
        { type: 'visit', encounterId: 'enc-123' },
        { secrets, headers: { Authorization: 'Bearer my-custom-token' } }
      );
      const result = validateRequestParameters(input);

      expect(result.userToken).toBe('my-custom-token');
    });
  });
});
