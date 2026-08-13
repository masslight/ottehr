import { FAX_MAX_VISITS } from 'utils/lib/types/api/fax.types';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/send-fax-packet/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const APPOINTMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const PATIENT_ID = '650e8400-e29b-41d4-a716-446655440000';
const DOCUMENT_ID = '750e8400-e29b-41d4-a716-446655440000';
const VISIT_SOURCE = { type: 'visit', appointmentId: APPOINTMENT_ID };

describe('send-fax-packet - validateRequestParameters', () => {
  const secrets = createMockSecrets();

  const body = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    source: VISIT_SOURCE,
    recipients: [{ faxNumber: '2125551234' }],
    ...overrides,
  });

  test('returns validated params for a valid request', () => {
    const result = validateRequestParameters(createMockZambdaInput(body(), { secrets }));

    expect(result).toEqual({
      source: VISIT_SOURCE,
      recipients: [{ faxNumber: '+12125551234', phoneNumber: undefined }],
      secrets,
    });
  });

  test('accepts every packet source', () => {
    const sources = [
      { type: 'visits', patientId: PATIENT_ID, appointmentIds: [APPOINTMENT_ID] },
      { type: 'medical-record', patientId: PATIENT_ID },
      { type: 'document', patientId: PATIENT_ID, documentReferenceId: DOCUMENT_ID },
    ];

    sources.forEach((source) => {
      expect(validateRequestParameters(createMockZambdaInput(body({ source }), { secrets })).source).toEqual(source);
    });
  });

  test('throws when the source type is unknown', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput(body({ source: { type: 'everything' } }), { secrets }))
    ).toThrow();
  });

  test('throws when no visit is selected', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(body({ source: { type: 'visits', patientId: PATIENT_ID, appointmentIds: [] } }), {
          secrets,
        })
      )
    ).toThrow();
  });

  test('throws when more visits are selected than a packet can carry', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          body({
            source: {
              type: 'visits',
              patientId: PATIENT_ID,
              appointmentIds: Array.from({ length: FAX_MAX_VISITS + 1 }, () => APPOINTMENT_ID),
            },
          }),
          { secrets }
        )
      )
    ).toThrow();
  });

  test('normalises every recipient fax number to +1 and the last ten digits', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '5551234567' }, { faxNumber: '+12125551234' }] }), {
        secrets,
      })
    );

    expect(result.recipients.map((recipient) => recipient.faxNumber)).toEqual(['+15551234567', '+12125551234']);
  });

  test('formats the follow-up phone number for display without rejecting it', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '2125551234', phoneNumber: '+12125559999' }] }), {
        secrets,
      })
    );

    expect(result.recipients[0].phoneNumber).toBe('(212) 555-9999');
  });

  test('passes an unparseable follow-up phone number through untouched', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(body({ recipients: [{ faxNumber: '2125551234', phoneNumber: 'ext 42' }] }), { secrets })
    );

    expect(result.recipients[0].phoneNumber).toBe('ext 42');
  });

  test('preserves recipient name, organization and saveAsPcp', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(
        body({
          recipients: [
            { name: 'Olivia Green', organization: 'Green Family Practice', faxNumber: '2125551234', saveAsPcp: true },
          ],
        }),
        { secrets }
      )
    );

    expect(result.recipients[0]).toEqual({
      name: 'Olivia Green',
      organization: 'Green Family Practice',
      faxNumber: '+12125551234',
      phoneNumber: undefined,
      saveAsPcp: true,
    });
  });

  test('throws when a recipient fax number is not a valid phone number', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput(body({ recipients: [{ faxNumber: '123' }] }), { secrets }))
    ).toThrow();
  });

  test('throws when a later recipient has an invalid fax number', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(body({ recipients: [{ faxNumber: '2125551234' }, { faxNumber: 'nope' }] }), { secrets })
      )
    ).toThrow();
  });

  test('throws when more than one recipient is flagged as the PCP', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(
          body({
            recipients: [
              { faxNumber: '2125551234', saveAsPcp: true },
              { faxNumber: '2125551235', saveAsPcp: true },
            ],
          }),
          { secrets }
        )
      )
    ).toThrow(/Only one recipient can be saved as the patient PCP/);
  });

  test('throws when the appointment id is not a valid UUID', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(body({ source: { type: 'visit', appointmentId: 'appt-123' } }), { secrets })
      )
    ).toThrow();
  });

  test('throws when there are no recipients', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(body({ recipients: [] }), { secrets }))).toThrow();
  });

  test('throws when there are more than five recipients', () => {
    expect(() =>
      validateRequestParameters(
        createMockZambdaInput(body({ recipients: Array.from({ length: 6 }, () => ({ faxNumber: '2125551234' })) }), {
          secrets,
        })
      )
    ).toThrow();
  });

  test('throws when the body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { secrets }))).toThrow();
  });

  test('throws when the Authorization header is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(body(), { secrets, headers: {} as any }))).toThrow();
  });
});
