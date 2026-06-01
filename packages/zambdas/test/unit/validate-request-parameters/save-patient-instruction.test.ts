import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/save-patient-instruction/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('save-patient-instruction - validateRequestParameters', () => {
  test('should return validated params with text', () => {
    const input = createMockZambdaInput({ text: 'Take medication twice daily' });
    const result = validateRequestParameters(input);

    expect(result.text).toBe('Take medication twice daily');
    expect(result.userToken).toBe('test-token');
    expect(result.secrets).toBeNull();
  });

  test('should return validated params with title', () => {
    const input = createMockZambdaInput({ title: 'Discharge Instructions' });
    const result = validateRequestParameters(input);

    expect(result.title).toBe('Discharge Instructions');
  });

  test('should return validated params with both text and title', () => {
    const input = createMockZambdaInput({ text: 'Take meds', title: 'Discharge' });
    const result = validateRequestParameters(input);

    expect(result.text).toBe('Take meds');
    expect(result.title).toBe('Discharge');
  });

  test('should return validated params with instructionId for update', () => {
    const input = createMockZambdaInput({ instructionId: 'inst-123', text: 'Updated text' });
    const result = validateRequestParameters(input);

    expect(result.instructionId).toBe('inst-123');
    expect(result.text).toBe('Updated text');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput({ text: 'Some instruction' }, { headers: { Authorization: undefined as any } });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when neither text nor title is provided', () => {
    const input = createMockZambdaInput({});
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when text is empty string', () => {
    const input = createMockZambdaInput({ text: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when text is whitespace only', () => {
    const input = createMockZambdaInput({ text: '   ' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when title is whitespace only', () => {
    const input = createMockZambdaInput({ title: '   ' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should extract Bearer token from Authorization header', () => {
    const input = createMockZambdaInput({ text: 'instruction' }, { headers: { Authorization: 'Bearer my-token' } });
    const result = validateRequestParameters(input);
    expect(result.userToken).toBe('my-token');
  });
});
