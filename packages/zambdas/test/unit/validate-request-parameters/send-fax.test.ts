import { FAX_MAX_TRANSMISSIONS, SEND_FAX_MAX_RECIPIENTS } from 'utils/lib/types/api/send-fax.types';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/send-fax/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const PATIENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const DOCUMENT_ID = '750e8400-e29b-41d4-a716-446655440000';

describe('send-fax - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const body = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    target: { type: 'visit-note', appointmentId: APPOINTMENT_ID },
    recipients: [{ faxNumber: '2125551234' }],
    ...overrides,
  });

  test('should return validated params for a valid request', () => {
    const result = validateRequestParameters(createMockZambdaInput(body(), { secrets }));

    expect(result).toEqual({
      target: { type: 'visit-note', appointmentId: APPOINTMENT_ID },
      recipients: [{ faxNumber: '+12125551234', name: undefined, organization: undefined, phoneNumber: undefined }],
      secrets,
    });
  });

  test('should keep the optional recipient details', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(
        body({
          recipients: [
            { faxNumber: '2125551234', name: ' Dr. Green ', organization: 'Urgent Care', phoneNumber: '2125559876' },
          ],
        }),
        { secrets }
      )
    );

    expect(result.recipients[0]).toEqual({
      faxNumber: '+12125551234',
      name: 'Dr. Green',
      organization: 'Urgent Care',
      phoneNumber: '2125559876',
    });
  });

  test('should drop blank optional recipient details', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '2125551234', name: '  ', phoneNumber: '' }] }), {
        secrets,
      })
    );

    expect(result.recipients[0].name).toBeUndefined();
    expect(result.recipients[0].phoneNumber).toBeUndefined();
  });

  test('should accept each fax target', () => {
    const targets = [
      { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID] },
      { type: 'medical-record', patientId: PATIENT_ID },
      { type: 'document', patientId: PATIENT_ID, documentReferenceId: DOCUMENT_ID },
    ];

    targets.forEach((target) => {
      expect(validateRequestParameters(createMockZambdaInput(body({ target }), { secrets })).target).toEqual(target);
    });
  });

  test('should throw when the target type is unknown', () => {
    const input = createMockZambdaInput(body({ target: { type: 'everything', patientId: PATIENT_ID } }), { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when appointmentId is not a valid UUID', () => {
    const input = createMockZambdaInput(body({ target: { type: 'visit-note', appointmentId: 'appt-123' } }), {
      secrets,
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when no visit is selected', () => {
    const input = createMockZambdaInput(
      body({ target: { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [] } }),
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should prepend +1 to every recipient fax number', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '6465554567' }, { faxNumber: '2125551234' }] }), {
        secrets,
      })
    );

    expect(result.recipients.map((recipient) => recipient.faxNumber)).toEqual(['+16465554567', '+12125551234']);
  });

  test('should normalize a formatted fax number before prepending the country code', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '(212) 555-1234' }] }), { secrets })
    );

    expect(result.recipients[0].faxNumber).toBe('+12125551234');
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when Authorization header is missing', () => {
    const input = createMockZambdaInput(body(), { secrets, headers: {} as any });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when the target is missing', () => {
    const input = createMockZambdaInput({ recipients: [{ faxNumber: '2125551234' }] }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when there are no recipients', () => {
    const input = createMockZambdaInput(body({ recipients: [] }), { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept a request at the transmission limit', () => {
    const appointmentIds = Array.from(
      { length: FAX_MAX_TRANSMISSIONS },
      (_, index) => `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`
    );
    const input = createMockZambdaInput(
      body({ target: { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds } }),
      { secrets }
    );
    expect(() => validateRequestParameters(input)).not.toThrow();
  });

  test('should throw when the selection exceeds the transmission limit', () => {
    const appointmentIds = Array.from(
      { length: FAX_MAX_TRANSMISSIONS },
      (_, index) => `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`
    );
    // Every visit goes to every recipient, so a second recipient doubles the work.
    const input = createMockZambdaInput(
      body({
        target: { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds },
        recipients: [{ faxNumber: '2125551234' }, { faxNumber: '2125559999' }],
      }),
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when there are more recipients than supported', () => {
    const recipients = Array.from({ length: SEND_FAX_MAX_RECIPIENTS + 1 }, () => ({ faxNumber: '2125551234' }));
    const input = createMockZambdaInput(body({ recipients }), { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a fax number is not a valid phone number', () => {
    const input = createMockZambdaInput(body({ recipients: [{ faxNumber: '123' }] }), { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should reject a structurally impossible NANP fax number', () => {
    const input = createMockZambdaInput(body({ recipients: [{ faxNumber: '5551234567' }] }), { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should reject duplicate visits', () => {
    const input = createMockZambdaInput(
      body({
        target: { type: 'visit-documents', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID, APPOINTMENT_ID] },
      }),
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should reject duplicate recipients regardless of formatting', () => {
    const input = createMockZambdaInput(
      body({ recipients: [{ faxNumber: '2125551234' }, { faxNumber: '(212) 555-1234' }] }),
      { secrets }
    );
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when a follow-up phone number is not a valid phone number', () => {
    const input = createMockZambdaInput(body({ recipients: [{ faxNumber: '2125551234', phoneNumber: '123' }] }), {
      secrets,
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
