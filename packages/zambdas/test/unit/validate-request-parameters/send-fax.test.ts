import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/send-fax/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('send-fax - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const validBody = {
    appointmentId: APPOINTMENT_ID,
    documents: ['visit-note', 'discharge-summary'],
    recipients: [{ name: 'Dr. Smith', organization: 'Smith Family Medicine', faxNumber: '2125551234' }],
  };

  test('should return validated params for a valid request', () => {
    const input = createMockZambdaInput(validBody, { secrets });
    const result = validateRequestParameters(input);

    expect(result).toEqual({
      appointmentId: APPOINTMENT_ID,
      // normalized to canonical display order
      documents: ['discharge-summary', 'visit-note'],
      recipients: [{ name: 'Dr. Smith', organization: 'Smith Family Medicine', faxNumber: '+12125551234' }],
      timezone: undefined,
      secrets,
    });
  });

  test('should prepend +1 to each recipient fax number', () => {
    const input = createMockZambdaInput(
      {
        ...validBody,
        recipients: [{ faxNumber: '5551234567' }, { faxNumber: '2125551234', phoneNumber: '2125555678' }],
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.recipients.map((r) => r.faxNumber)).toEqual(['+15551234567', '+12125551234']);
  });

  test('should dedupe documents and keep canonical order', () => {
    const input = createMockZambdaInput(
      { ...validBody, documents: ['patient-education', 'visit-note', 'lab-results', 'visit-note'] },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.documents).toEqual(['visit-note', 'lab-results', 'patient-education']);
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput({ ...validBody, appointmentId: 'appt-123' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(validBody, { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is missing', () => {
    const { appointmentId: _appointmentId, ...body } = validBody;
    const input = createMockZambdaInput(body, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when documents is empty', () => {
    const input = createMockZambdaInput({ ...validBody, documents: [] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when documents contains an unknown type', () => {
    const input = createMockZambdaInput({ ...validBody, documents: ['visit-note', 'chart-export'] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when recipients is empty', () => {
    const input = createMockZambdaInput({ ...validBody, recipients: [] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a recipient fax number is missing', () => {
    const input = createMockZambdaInput({ ...validBody, recipients: [{ name: 'Dr. Smith' }] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a recipient fax number is not a valid phone number', () => {
    const input = createMockZambdaInput({ ...validBody, recipients: [{ faxNumber: '123' }] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when any recipient in the list has an invalid fax number', () => {
    const input = createMockZambdaInput(
      { ...validBody, recipients: [{ faxNumber: '2125551234' }, { faxNumber: 'abc' }] },
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
