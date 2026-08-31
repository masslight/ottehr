import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-employees/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-employees - validateRequestParameters', () => {
  test('should return lite=false when body is missing', () => {
    const input = createMockZambdaInput(null, { body: null as any });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
    expect(result.secrets).toBeNull();
  });

  test('should return lite=false when body is empty string', () => {
    const input = createMockZambdaInput(null, { body: '' as any });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
  });

  test('should return lite=true when lite is true', () => {
    const input = createMockZambdaInput({ lite: true });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(true);
  });

  test('should return lite=false when lite is false', () => {
    const input = createMockZambdaInput({ lite: false });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
  });

  test('should return lite=false when lite is not a boolean true', () => {
    const input = createMockZambdaInput({ lite: 'true' });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
  });

  test('should return lite=false when body is invalid JSON', () => {
    const input = createMockZambdaInput(null, { body: 'not-json' });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
  });

  test('should return lite=false when body has no lite field', () => {
    const input = createMockZambdaInput({ somethingElse: true });
    const result = validateRequestParameters(input);

    expect(result.lite).toBe(false);
  });

  test('should pass through secrets', () => {
    const input = createMockZambdaInput({ lite: true }, { secrets: { PROJECT_API: 'https://api' } });
    const result = validateRequestParameters(input);

    expect(result.secrets).toEqual({ PROJECT_API: 'https://api' });
  });
});
