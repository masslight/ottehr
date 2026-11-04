import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient, ServiceRequest } from 'fhir/r4b';
import { makeReferralServiceRequest } from 'utils/lib/fhir/referral';
import { SaveReferralInput } from 'utils/lib/types/api/referrals/referrals.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockGetOrCreateReferralForm, mockCaptureException } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn(), create: vi.fn(), update: vi.fn(), patch: vi.fn() } },
  mockGetOrCreateReferralForm: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  requireUserWithRole: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehr),
}));

vi.mock('../../src/shared/practitioners', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveCallerPractitionerRef: vi
    .fn()
    .mockResolvedValue({ reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }),
}));

vi.mock('../../src/shared/referrals/referral-form', () => ({
  getOrCreateReferralForm: (...args: unknown[]) => mockGetOrCreateReferralForm(...args),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { index as rawIndex } from '../../src/ehr/referrals/save-referral';

const saveReferral = rawIndex as unknown as ZambdaHandler;

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PATIENT_ID = '99999999-9999-4999-8999-999999999999';
const ENCOUNTER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ENCOUNTER_ID = '55555555-5555-4555-8555-555555555555';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-11-01T15:00:00.000Z';

const body: SaveReferralInput = {
  patientId: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  specialty: 'Orthopedics',
  reason: 'Distal radius fracture',
  urgency: 'urgent',
  whatIsAsked: 'evaluate-and-treat',
  whoSchedules: 'patient',
  responseRequested: false,
  includeDocuments: [],
};

const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Maya'], family: 'Example' }] };
const encounterOf = (patientId: string, id = ENCOUNTER_ID): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: `Patient/${patientId}` },
});

const existingReferral = (patientId: string, encounterId?: string): ServiceRequest => {
  const base = makeReferralServiceRequest(
    { ...body, patientId, encounterId },
    { patientId, encounterId, requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }, now: NOW }
  );
  return { ...base, id: REFERRAL_ID, meta: { ...base.meta, versionId: '2' } };
};

const run = async (input: Partial<SaveReferralInput>): Promise<APIGatewayProxyResult> =>
  saveReferral(createMockZambdaInput({ ...body, ...input }, { secrets: createMockSecrets() }));

describe('save-referral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [] });
    mockOystehr.fhir.create.mockImplementation(async (resource: ServiceRequest) => ({
      ...resource,
      id: REFERRAL_ID,
      meta: { ...resource.meta, versionId: '1' },
    }));
    mockOystehr.fhir.update.mockImplementation(async (resource: ServiceRequest) => resource);
    mockGetOrCreateReferralForm.mockResolvedValue({
      documentReference: { resourceType: 'DocumentReference', id: 'form-1' },
      z3Url: 'z3://referrals/form.pdf',
    });
  });

  const reads = (resources: { encounter?: Encounter; referral?: ServiceRequest }): void => {
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Patient') return patient;
      if (resourceType === 'Encounter' && resources.encounter) return resources.encounter;
      if (resourceType === 'ServiceRequest' && resources.referral) return resources.referral;
      throw new Error(`unexpected get for ${resourceType}`);
    });
  };

  it('rejects a fax that is not a phone number before reading anything', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });

    const result = await run({ recipientContactId: '33333333-3333-4333-8333-333333333333', recipientFax: 'call me' });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: '"call me" is not a valid fax number',
    });
    expect(mockOystehr.fhir.get).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('SECURITY: refuses a visit that belongs to another patient before writing anything', async () => {
    reads({ encounter: encounterOf(OTHER_PATIENT_ID) });

    const result = await run({});

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: 'Visit does not belong to this patient',
    });
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it("SECURITY: reports another patient's referral as not found rather than editing it", async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(OTHER_PATIENT_ID, ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
      message: `Referral ${REFERRAL_ID} not found`,
    });
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('refuses to move a referral to another visit', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, OTHER_ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('The visit of a referral cannot change');
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('updates an existing referral against the version it read', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });

    const result = await run({ referralId: REFERRAL_ID, reason: 'Fracture, follow-up imaging' });

    expect(result.statusCode).toBe(200);
    const [updated, options] = mockOystehr.fhir.update.mock.calls[0];
    expect(updated.id).toBe(REFERRAL_ID);
    expect(updated.reasonCode[0].text).toBe('Fracture, follow-up imaging');
    expect(options).toEqual({ optimisticLockingVersionId: '2' });
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('reports a concurrent edit as a precondition failure', async () => {
    reads({ encounter: encounterOf(PATIENT_ID), referral: existingReferral(PATIENT_ID, ENCOUNTER_ID) });
    mockOystehr.fhir.update.mockRejectedValue(Object.assign(new Error('conflict'), { code: 412 }));

    const result = await run({ referralId: REFERRAL_ID });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.PRECONDITION_FAILED);
  });

  it('still returns the saved referral when the form cannot be generated, so a retry never duplicates it', async () => {
    reads({ encounter: encounterOf(PATIENT_ID) });
    const failure = new Error('Z3 upload failed');
    mockGetOrCreateReferralForm.mockRejectedValue(failure);

    const result = await run({});

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral).toMatchObject({ id: REFERRAL_ID, status: 'not-sent' });
    expect(mockOystehr.fhir.create).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(failure);
  });
});
