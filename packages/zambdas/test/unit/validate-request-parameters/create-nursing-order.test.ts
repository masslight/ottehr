import { randomUUID } from 'crypto';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/create-nursing-order/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('create-nursing-order - validateRequestParameters', () => {
  const validEncounterId = randomUUID();

  test('should return validated params with encounterId and notes', () => {
    const input = createMockZambdaInput({ encounterId: validEncounterId, notes: 'Administer medication' });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe(validEncounterId);
    expect(result.notes).toBe('Administer medication');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should accept encounterId without notes (notes is optional)', () => {
    const input = createMockZambdaInput({ encounterId: validEncounterId });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe(validEncounterId);
    expect(result.notes).toBeUndefined();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(
      { encounterId: validEncounterId },
      {
        headers: {},
      }
    );
    expect(() => validateRequestParameters(input)).toThrow('Authorization');
  });

  test('should throw when encounterId is missing', () => {
    const input = createMockZambdaInput({ notes: 'some notes' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is not a valid UUID', () => {
    const input = createMockZambdaInput({ encounterId: 'not-a-uuid' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is a number', () => {
    const input = createMockZambdaInput({ encounterId: 12345 });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(
      { encounterId: validEncounterId },
      {
        headers: { Authorization: 'Bearer my-auth-token' },
      }
    );
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-auth-token');
  });
});
