import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/patient/appointment/prebook-update-appointment/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('prebook-update-appointment - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validSlot = {
    resourceType: 'Slot',
    start: '2025-06-10T10:00:00',
    end: '2025-06-10T10:15:00',
    status: 'free',
  };

  const validBody = {
    appointmentID: '550e8400-e29b-41d4-a716-446655440000',
    slot: validSlot,
    language: 'English',
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.slot).toMatchObject({ start: '2025-06-10T10:00:00' });
    expect(result.language).toBe('English');
    expect(result.secrets).toBe(secrets);
  });

  test('should return validated params without optional language field', () => {
    const { language: _, ...bodyWithoutLanguage } = validBody;
    const input = createMockZambdaInput(bodyWithoutLanguage, { secrets });
    const result = validateRequestParameters(input);

    expect(result.appointmentID).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.slot).toMatchObject({ start: '2025-06-10T10:00:00' });
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const { appointmentID: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when slot is missing', () => {
    const { slot: _, ...rest } = validBody;
    const input = createMockZambdaInput(rest, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentID: 'appt-not-uuid' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when slot.start is not a valid ISO datetime', () => {
    const input = createMockZambdaInput({ ...validBody, slot: { ...validSlot, start: 'not-a-date' } }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when slot.start is missing', () => {
    const { start: _, ...slotWithoutStart } = validSlot;
    const input = createMockZambdaInput({ ...validBody, slot: slotWithoutStart }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept a second valid UUID for appointmentID', () => {
    const input = createMockZambdaInput(
      { ...validBody, appointmentID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
      { secrets }
    );
    const result = validateRequestParameters(input);
    expect(result.appointmentID).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
