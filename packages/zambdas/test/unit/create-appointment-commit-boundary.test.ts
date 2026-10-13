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
  isM2MClient: vi.fn(() => true),
  getM2MClientId: vi.fn(() => 'm2m-1'),
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
const { index } = await import('../../src/patient/appointment/create-appointment/index');

const fhirRejection = (): Error =>
  new Oystehr.OystehrFHIRError({
    code: 400,
    error: {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'structure', details: { text: 'Invalid date format - POST /Patient' } }],
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

describe('create-appointment translates only pre-commit FHIR rejections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('answers a rejection of the booking transaction with a 400, since nothing was committed', async () => {
    transaction.mockRejectedValue(fhirRejection());

    const response = await invoke();

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).code).toBe(APIErrorCode.FHIR_RESOURCE_VALIDATION_ERROR);
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
