import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, OperationOutcome, Questionnaire, Slot } from 'fhir/r4b';
import { ScheduleOwnerFhirResource } from 'utils/lib/types/api/schedules';
import { ServiceMode } from 'utils/lib/types/common';
import { PatientInfo, VisitType } from 'utils/lib/types/data/telemed/appointments/create-appointment.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

const transaction = vi.fn();
const generateFriendlyPatientId = vi.fn(async () => ({ resourceType: 'Patient', id: 'patient-1' }));
const oystehrStub = { fhir: { transaction, generateFriendlyPatientId } } as unknown as Oystehr;

const QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  id: 'questionnaire-1',
  url: 'https://ottehr.com/Questionnaire/test',
  version: '1.0.0',
  status: 'active',
  item: [],
};

const slot: Slot = {
  resourceType: 'Slot',
  id: 'slot-1',
  status: 'busy-tentative',
  start: '2030-01-01T10:00:00.000Z',
  end: '2030-01-01T10:15:00.000Z',
  schedule: { reference: 'Schedule/sched-1' },
};

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/auth')>()),
  getCaller: vi.fn(async () => ({ m2m: { id: 'm2m-1', isValid: async () => true } })),
}));

vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn(async () => 'token') }));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: vi.fn(() => oystehrStub),
}));

vi.mock('../../src/patient/appointment/create-appointment/validateRequestParameters', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../src/patient/appointment/create-appointment/validateRequestParameters')
  >()),
  validateCreateAppointmentParams: vi.fn(() => ({ secrets: { ENVIRONMENT: 'local' }, language: 'en' })),
  createAppointmentComplexValidation: vi.fn(async () => ({
    slot,
    scheduleOwner: { resourceType: 'Location', id: 'loc-1' } as ScheduleOwnerFhirResource,
    serviceMode: ServiceMode['in-person'],
    // No patient.id → the post-commit new-patient branch runs.
    patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-15', sex: 'female' } as PatientInfo,
    questionnaireCanonical: 'https://ottehr.com/Questionnaire/test|1.0.0',
    visitType: VisitType.PreBook,
  })),
}));

vi.mock('../../src/shared/appointment/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/appointment/helpers')>()),
  generatePatientRelatedRequests: vi.fn(async () => ({
    verifiedPhoneNumber: '+15555555555',
    listRequests: [],
    createPatientRequest: {
      method: 'POST',
      url: '/Patient',
      fullUrl: 'urn:uuid:11111111-1111-1111-1111-111111111111',
      resource: { resourceType: 'Patient', birthDate: '1990-01-15' },
    },
    updatePatientRequest: undefined,
    isEHRUser: false,
    maybeFhirPatient: undefined,
  })),
}));

vi.mock('utils/lib/fhir/questionnaires', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/fhir/questionnaires')>()),
  getCanonicalQuestionnaire: vi.fn(async () => QUESTIONNAIRE),
  resolveEffectiveQuestionnaire: vi.fn(async () => QUESTIONNAIRE),
}));

vi.mock('../../src/patient/appointment/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/patient/appointment/helpers')>()),
  getRelatedResources: vi.fn(async () => ({ documents: [], accountInfo: undefined })),
}));

vi.mock('utils/lib/fhir/patient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/fhir/patient')>()),
  createUserResourcesForPatient: vi.fn(),
}));

const { createUserResourcesForPatient } = await import('utils/lib/fhir/patient');
const { createAppointmentComplexValidation } = await import(
  '../../src/patient/appointment/create-appointment/validateRequestParameters'
);
const { index } = await import('../../src/patient/appointment/create-appointment/index');

// The exact OperationOutcome the FHIR API returned when a Patient.birthDate that Luxon accepted was
// not a FHIR `date`. Before the rejection was translated, the caller got `500 {"error":"Internal error"}`.
const fhirRejection = (): Error =>
  new Oystehr.OystehrFHIRError({
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

// What the FHIR server returns once the booking is committed: every resource the handler reads back.
const committedBundle: Bundle = {
  resourceType: 'Bundle',
  type: 'transaction-response',
  entry: [
    { resource: { resourceType: 'Appointment', id: 'appt-1', status: 'booked', participant: [] } },
    { resource: { resourceType: 'Encounter', id: 'enc-1', status: 'planned', class: { code: 'AMB' } } },
    { resource: { resourceType: 'Patient', id: 'patient-1' } },
    { resource: { resourceType: 'QuestionnaireResponse', id: 'qr-1', status: 'in-progress' } },
  ],
};

const invoke = async (): Promise<APIGatewayProxyResult> =>
  (index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    headers: { Authorization: 'Bearer token' },
    body: JSON.stringify({ slotId: 'slot-1', patient: {} }),
    secrets: { ENVIRONMENT: 'local' },
  } as unknown as ZambdaInput);

describe('create-appointment translates only FHIR rejections of the booking transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  // 422 rather than 400: the shared translator reports every FHIR validation failure as
  // Unprocessable Entity. The OperationOutcome names internal resources and elements, and this
  // endpoint answers patients, so its details are logged and sent to Sentry, never returned.
  it('answers a rejection of the booking transaction with a 422 that keeps the FHIR details server-side', async () => {
    transaction.mockRejectedValue(fhirRejection());

    const response = await invoke();

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR,
      message: 'The appointment could not be created with the information provided',
    });
    expect(console.error).toHaveBeenCalledWith(
      'FHIR validation failed: Invalid date format - POST /Patient (Patient.birthDate)'
    );
  });

  // Everything FHIR sees before the transaction is built by us (slotId is a schema-checked UUID),
  // so a rejection there is our bug, and a 4xx would wrongly tell the caller to fix their input.
  it('answers a rejection during complex validation with a 500', async () => {
    vi.mocked(createAppointmentComplexValidation).mockRejectedValueOnce(fhirRejection());

    const response = await invoke();

    expect(transaction).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Internal error' });
  });

  // The booking exists by this point, so a 400 would invite the caller to fix their input and retry,
  // which would double-book them. A failure here is ours to fix, so it stays a 500.
  it('answers a rejection after the booking is committed with a 500', async () => {
    transaction.mockResolvedValue(committedBundle);
    vi.mocked(createUserResourcesForPatient).mockRejectedValue(fhirRejection());

    const response = await invoke();

    expect(transaction).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Internal error' });
  });
});
