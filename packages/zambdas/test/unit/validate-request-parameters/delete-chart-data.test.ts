import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/delete-chart-data/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('delete-chart-data - validateRequestParameters', () => {
  test('should return validated params when encounterId is provided', () => {
    const input = createMockZambdaInput({ encounterId: 'enc-123' });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('enc-123');
    expect(result.secrets).toBeNull();
  });

  test('should spread all body data into result', () => {
    const input = createMockZambdaInput({
      encounterId: 'enc-123',
      chartDataResourceType: 'vitals',
      resourceId: 'res-456',
    });
    const result = validateRequestParameters(input);

    expect(result.encounterId).toBe('enc-123');
    expect(result).toHaveProperty('chartDataResourceType', 'vitals');
    expect(result).toHaveProperty('resourceId', 'res-456');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when encounterId is undefined', () => {
    const input = createMockZambdaInput({ someOtherField: 'value' });
    expect(() => validateRequestParameters(input)).toThrow('encounterId');
  });

  test('should pass secrets through from input', () => {
    const secrets = { PROJECT_API: 'https://api.test' };
    const input = createMockZambdaInput({ encounterId: 'enc-123' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });
});
