import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/rcm/payments/save-terminal-location/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const VALID_LOCATION_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('save-terminal-location - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  test('should return validated params with a terminalLocationId', () => {
    const input = createMockZambdaInput(
      { locationId: VALID_LOCATION_UUID, terminalLocationId: 'tml_loc_abc123' },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      locationId: VALID_LOCATION_UUID,
      terminalLocationId: 'tml_loc_abc123',
      secrets,
    });
  });

  test('should return null terminalLocationId when not provided', () => {
    const input = createMockZambdaInput({ locationId: VALID_LOCATION_UUID }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.locationId).toBe(VALID_LOCATION_UUID);
    expect(result.terminalLocationId).toBeNull();
  });

  test('should return null terminalLocationId when explicitly null', () => {
    const input = createMockZambdaInput({ locationId: VALID_LOCATION_UUID, terminalLocationId: null }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.terminalLocationId).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is missing', () => {
    const input = createMockZambdaInput({ terminalLocationId: 'tml_loc_abc123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationId is not a valid UUID', () => {
    const input = createMockZambdaInput(
      { locationId: 'not-a-uuid', terminalLocationId: 'tml_loc_abc123' },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when terminalLocationId is an empty string', () => {
    const input = createMockZambdaInput({ locationId: VALID_LOCATION_UUID, terminalLocationId: '' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
