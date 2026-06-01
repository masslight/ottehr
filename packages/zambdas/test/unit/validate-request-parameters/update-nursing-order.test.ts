import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/update-nursing-order/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('update-nursing-order - validateRequestParameters', () => {
  const validBody = {
    serviceRequestId: 'sr-123',
    action: 'CANCEL ORDER' as const,
  };

  test('should return validated params for CANCEL ORDER', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.serviceRequestId).toBe('sr-123');
    expect(result.action).toBe('CANCEL ORDER');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should return validated params for COMPLETE ORDER', () => {
    const input = createMockZambdaInput({ serviceRequestId: 'sr-456', action: 'COMPLETE ORDER' });
    const result = validateRequestParameters(input);

    expect(result.serviceRequestId).toBe('sr-456');
    expect(result.action).toBe('COMPLETE ORDER');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, { headers: {} });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when serviceRequestId is missing', () => {
    const input = createMockZambdaInput({ action: 'CANCEL ORDER' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when action is missing', () => {
    const input = createMockZambdaInput({ serviceRequestId: 'sr-123' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when action is invalid', () => {
    const input = createMockZambdaInput({ serviceRequestId: 'sr-123', action: 'INVALID ACTION' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput(validBody, {
      headers: { Authorization: 'Bearer my-auth-token' },
    });
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-auth-token');
  });

  test('should throw when serviceRequestId is not a string', () => {
    const input = createMockZambdaInput({ serviceRequestId: 123, action: 'CANCEL ORDER' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept empty string serviceRequestId (current schema allows it)', () => {
    const input = createMockZambdaInput({ serviceRequestId: '', action: 'CANCEL ORDER' });
    const result = validateRequestParameters(input);
    expect(result.serviceRequestId).toBe('');
  });
});
