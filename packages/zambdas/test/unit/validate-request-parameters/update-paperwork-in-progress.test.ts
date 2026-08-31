import { describe, expect, test } from 'vitest';
import { validateUpdatePaperworkParams } from '../../../src/patient/paperwork/update-paperwork-in-progress/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('update-paperwork-in-progress - validateUpdatePaperworkParams', () => {
  const validAppointmentId = '550e8400-e29b-41d4-a716-446655440000';
  const validInProgress = '2024-01-15T10:30:00.000Z';

  const validBody = {
    appointmentID: validAppointmentId,
    inProgress: validInProgress,
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateUpdatePaperworkParams(input);

    expect(result.appointmentID).toBe(validAppointmentId);
    expect(result.inProgress).toBe(validInProgress);
  });

  test('should accept a valid ISO datetime string', () => {
    const input = createMockZambdaInput({ ...validBody, inProgress: '2024-06-10T15:45:00.000-05:00' });
    const result = validateUpdatePaperworkParams(input);
    expect(result.inProgress).toBe('2024-06-10T15:45:00.000-05:00');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: null });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when body is empty string', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when appointmentID is missing', () => {
    const input = createMockZambdaInput({ inProgress: validInProgress });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when appointmentID is not a valid UUID', () => {
    const input = createMockZambdaInput({ appointmentID: 'appt-123', inProgress: validInProgress });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when appointmentID is empty string', () => {
    const input = createMockZambdaInput({ appointmentID: '', inProgress: validInProgress });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when inProgress is missing', () => {
    const input = createMockZambdaInput({ appointmentID: validAppointmentId });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when inProgress is not a valid ISO string', () => {
    const input = createMockZambdaInput({ appointmentID: validAppointmentId, inProgress: 'not-a-date' });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when inProgress is an empty string', () => {
    const input = createMockZambdaInput({ appointmentID: validAppointmentId, inProgress: '' });
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should throw when both fields are missing', () => {
    const input = createMockZambdaInput({});
    expect(() => validateUpdatePaperworkParams(input)).toThrow();
  });

  test('should accept a second valid UUID format', () => {
    const input = createMockZambdaInput({
      appointmentID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      inProgress: validInProgress,
    });
    const result = validateUpdatePaperworkParams(input);
    expect(result.appointmentID).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  });
});
