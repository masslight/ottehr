import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUser } from '../../../shared/auth';
import { complexValidation, ValidatedInput } from './validation';

vi.mock('../../../shared/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../shared/auth')>();
  return { ...original, getUser: vi.fn() };
});

const mockGetUser = vi.mocked(getUser);

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';
const PATIENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const OTHER_PATIENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c9';

const EHR_USER = { id: 'staff-1', name: 'staff@example.com' } as never;
const PATIENT_USER = { id: 'patient-1', name: '+15555550123' } as never;

const sentManually = (overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: QR_ID,
  status: 'completed',
  subject: { reference: `Patient/${PATIENT_ID}` },
  meta: { tag: [QR_DISTRIBUTION_TAG] },
  ...overrides,
});

const oystehr = {
  fhir: { get: vi.fn() },
} as unknown as Oystehr;

const fhirGet = oystehr.fhir.get as ReturnType<typeof vi.fn>;

const input: ValidatedInput = {
  body: { questionnaireResponseId: QR_ID, patientId: PATIENT_ID },
  callerAccessToken: 'token',
};

const validate = (): Promise<unknown> => complexValidation(input, {} as Secrets, oystehr);

beforeEach(() => {
  vi.clearAllMocks();
  fhirGet.mockResolvedValue(sentManually());
  mockGetUser.mockResolvedValue(EHR_USER);
});

// This zambda is registered as `http_auth`, which any authenticated token in the project can invoke —
// including a patient's. Deleting a submitted form is a staff-only action, so the gate has to be "is
// an EHR user", not "has access to this patient": a patient passes the latter for their own record
// and could otherwise hide the form they were sent.
describe('delete-visit-form authorization', () => {
  it('rejects a patient-app caller even when the response is their own', async () => {
    mockGetUser.mockResolvedValue(PATIENT_USER);

    await expect(validate()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a caller whose token resolves to no user', async () => {
    mockGetUser.mockResolvedValue(undefined as never);

    await expect(validate()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('accepts an EHR user', async () => {
    await expect(validate()).resolves.toMatchObject({ questionnaireResponse: sentManually() });
  });
});

describe('delete-visit-form response lookup', () => {
  it('reports a response that cannot be read as not found', async () => {
    fhirGet.mockRejectedValue(new Error('boom'));

    await expect(validate()).rejects.toMatchObject({ message: expect.stringContaining(QR_ID) });
  });

  // The patient id is what ties the delete to the record the caller is looking at. Without this an
  // EHR user could pass any response id and soft-delete a form on someone else's chart.
  it("refuses a response that belongs to a different patient's record", async () => {
    fhirGet.mockResolvedValue(sentManually({ subject: { reference: `Patient/${OTHER_PATIENT_ID}` } }));

    await expect(validate()).rejects.toMatchObject({ message: expect.stringContaining(OTHER_PATIENT_ID) });
  });

  it('refuses a response with no subject at all', async () => {
    fhirGet.mockResolvedValue(sentManually({ subject: undefined }));

    await expect(validate()).rejects.toMatchObject({ message: expect.stringContaining('no patient') });
  });
});

// Delete flips the whole QuestionnaireResponse to 'entered-in-error'. A form bundled into the
// visit's paperwork flow shares one response with consent and every other page of that paperwork, so
// deleting through it would take the entire visit's paperwork with it. Only a response that was sent
// to the patient on its own — the QR_DISTRIBUTION_TAG — belongs to a single form.
describe('delete-visit-form standalone-response guard', () => {
  it("refuses the visit's shared intake paperwork response", async () => {
    fhirGet.mockResolvedValue(sentManually({ meta: { tag: [] } }));

    await expect(validate()).rejects.toMatchObject({
      message: expect.stringContaining('sent to the patient on its own'),
    });
  });

  it('refuses a response carrying some other tag', async () => {
    fhirGet.mockResolvedValue(
      sentManually({ meta: { tag: [{ system: 'http://example.org/other', code: 'practitioner' }] } })
    );

    await expect(validate()).rejects.toMatchObject({
      message: expect.stringContaining('sent to the patient on its own'),
    });
  });

  // Delete is idempotent: the effect no-ops on an already-deleted response rather than erroring, so
  // validation must let it through instead of surfacing a failure for a form that is already gone.
  it('allows an already-deleted response through', async () => {
    fhirGet.mockResolvedValue(sentManually({ status: 'entered-in-error' }));

    await expect(validate()).resolves.toBeDefined();
  });
});
