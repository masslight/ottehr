import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { OperationOutcome } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/auth')>()),
  getCaller: vi.fn(async () => ({ m2m: { id: 'm2m-1', isValid: async () => true } })),
}));

vi.mock('../../src/shared/getAuth0Token', () => ({
  getAuth0Token: vi.fn(async () => 'token'),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: vi.fn(() => ({}) as Oystehr),
}));

vi.mock('../../src/patient/appointment/create-appointment/validateRequestParameters', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../src/patient/appointment/create-appointment/validateRequestParameters')
  >()),
  validateCreateAppointmentParams: vi.fn(() => ({ secrets: { ENVIRONMENT: 'local' }, language: 'en' })),
  createAppointmentComplexValidation: vi.fn(),
}));

const { createAppointmentComplexValidation } = await import(
  '../../src/patient/appointment/create-appointment/validateRequestParameters'
);
const { index } = await import('../../src/patient/appointment/create-appointment/index');

const input = {
  headers: { Authorization: 'Bearer token' },
  body: JSON.stringify({ slotId: 'slot-1', patient: {} }),
  secrets: { ENVIRONMENT: 'local' },
} as unknown as ZambdaInput;

const invoke = async (): Promise<APIGatewayProxyResult> =>
  (index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(input);

// The exact OperationOutcome the FHIR API returned when a Patient.birthDate that Luxon accepted was
// not a FHIR `date`. Before the rejection was translated, the caller got `500 {"error":"Internal error"}`.
const invalidBirthDate = new Oystehr.OystehrFHIRError({
  code: 400,
  error: {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'structure',
        details: { text: 'Invalid date format - POST /Patient' },
        expression: ['Patient.birthDate'],
      },
    ],
  } as OperationOutcome,
});

describe('create-appointment FHIR rejection handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  // 422 rather than 400: the shared translator reports every FHIR validation failure as
  // Unprocessable Entity. What matters to callers is the APIErrorCode they branch on, and that the
  // response is no longer an opaque 500.
  it('answers a FHIR rejection with a 422, not a 500', async () => {
    vi.mocked(createAppointmentComplexValidation).mockRejectedValue(invalidBirthDate);

    const response = await invoke();

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
      message: 'FHIR validation failed: Invalid date format - POST /Patient (Patient.birthDate)',
    });
  });

  it('still answers an unrecognized failure with a 500', async () => {
    vi.mocked(createAppointmentComplexValidation).mockRejectedValue(new Error('Schedule owner not found'));

    const response = await invoke();

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Internal error' });
  });

  it('passes an APIError thrown by our own validation through untouched', async () => {
    vi.mocked(createAppointmentComplexValidation).mockRejectedValue({
      code: APIErrorCode.SLOT_UNAVAILABLE,
      message: 'Slot is not available',
    });

    const response = await invoke();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      code: APIErrorCode.SLOT_UNAVAILABLE,
      message: 'Slot is not available',
    });
  });
});
