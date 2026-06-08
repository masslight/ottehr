import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/delete-patient-instruction/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('delete-patient-instruction - validateRequestParameters', () => {
  const UUID_1 = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params with instructionId', () => {
    const input = createMockZambdaInput({ instructionId: UUID_1 });
    const result = validateRequestParameters(input);

    expect(result.instructionId).toBe(UUID_1);
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({ instructionId: UUID_1 }, { headers: { Authorization: undefined as any } });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when instructionId is missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when instructionId is empty string', () => {
    const input = createMockZambdaInput({ instructionId: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when instructionId is not a valid UUID', () => {
    const input = createMockZambdaInput({ instructionId: 'inst-123' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput({ instructionId: UUID_1 }, { headers: { Authorization: 'Bearer my-token' } });
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-token');
  });
});
