import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest, Task } from 'fhir/r4b';
import { TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { getReferralDetails, makeReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import { REFERRAL_TASK, ReferralStatus } from 'utils/lib/types/api/referrals/referrals.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn(), update: vi.fn(), patch: vi.fn() } },
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

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index as rawIndex } from '../../src/ehr/referrals/update-referral-status';

const updateReferralStatus = rawIndex as unknown as ZambdaHandler;

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const REFERRAL_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-11-01T15:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

const referralIn = (status: ReferralStatus): ServiceRequest => {
  const base = makeReferralServiceRequest(
    {
      patientId: PATIENT_ID,
      specialty: 'Orthopedics',
      reason: 'Distal radius fracture',
      urgency: 'asap',
      whatIsAsked: 'evaluate-and-treat',
      whoSchedules: 'patient',
      responseRequested: true,
      includeDocuments: [],
    },
    { patientId: PATIENT_ID, requester: { reference: 'Practitioner/prac-1', display: 'Jordan Rivera, MD' }, now: NOW }
  );
  return withReferralDetails({ ...base, id: REFERRAL_ID, meta: { ...base.meta, versionId: '5' } }, { status });
};

const openTask: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
  basedOn: [{ reference: `ServiceRequest/${REFERRAL_ID}` }],
  input: [
    { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: REFERRAL_TASK.input.urgency }] }, valueString: 'asap' },
  ],
};

const run = async (body: Record<string, unknown>): Promise<APIGatewayProxyResult> =>
  updateReferralStatus(createMockZambdaInput({ referralId: REFERRAL_ID, ...body }, { secrets: createMockSecrets() }));

const savedReferral = (): ServiceRequest => mockOystehr.fhir.update.mock.calls[0][0];

describe('update-referral-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The referral is tagged `referral` by makeReferralServiceRequest; the open task is found by every task search.
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Task' ? [openTask] : []),
    }));
    mockOystehr.fhir.update.mockImplementation(async (resource: ServiceRequest) => resource);
    mockOystehr.fhir.patch.mockResolvedValue(openTask);
  });

  describe.each<ReferralStatus>(['not-sent', 'sent', 'given-to-patient', 'response-received'])('from %s', (status) => {
    it('closes the referral with the reason and completes its task', async () => {
      mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

      const result = await run({ action: 'close', reason: 'patient-seen', outcome: 'Cast applied' });

      expect(result.statusCode).toBe(200);
      expect(getReferralDetails(savedReferral())).toMatchObject({
        status: 'closed',
        closeReason: 'patient-seen',
        outcome: 'Cast applied',
        closedAt: expect.any(String),
      });
      expect(savedReferral().status).toBe('completed');
      expect(mockOystehr.fhir.patch).toHaveBeenCalledWith({
        resourceType: 'Task',
        id: 'task-1',
        operations: [{ op: 'replace', path: '/status', value: 'completed' }],
      });
      expect(JSON.parse(result.body).referral).toMatchObject({ id: REFERRAL_ID, status: 'closed' });
    });

    it('cancels the referral and cancels its task', async () => {
      mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

      const result = await run({ action: 'cancel' });

      expect(result.statusCode).toBe(200);
      expect(getReferralDetails(savedReferral())).toMatchObject({ status: 'cancelled', closedAt: expect.any(String) });
      expect(mockOystehr.fhir.patch).toHaveBeenCalledWith(
        expect.objectContaining({ operations: [{ op: 'replace', path: '/status', value: 'cancelled' }] })
      );
    });
  });

  it.each<ReferralStatus>(['closed', 'cancelled'])('refuses to close or cancel a %s referral', async (status) => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

    for (const body of [{ action: 'close', reason: 'reviewed' }, { action: 'cancel' }]) {
      const result = await run(body);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).code).toBe(APIErrorCode.INVALID_INPUT);
    }
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('marks a not-sent referral given to the patient and starts the task clock from now', async () => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn('not-sent'));
    const before = Date.now();

    const result = await run({ action: 'given-to-patient' });

    expect(result.statusCode).toBe(200);
    expect(getReferralDetails(savedReferral())).toMatchObject({
      status: 'given-to-patient',
      givenToPatientAt: expect.any(String),
    });
    expect(savedReferral().status).toBe('active');
    // The task is not settled, only timed: asap = 2 days from the handover.
    expect(mockOystehr.fhir.patch).toHaveBeenCalledTimes(1);
    const [{ operations }] = mockOystehr.fhir.patch.mock.calls[0];
    expect(operations).toEqual([{ op: 'add', path: '/restriction', value: { period: { end: expect.any(String) } } }]);
    const end = Date.parse(operations[0].value.period.end);
    expect(end).toBeGreaterThanOrEqual(before + 2 * DAY_MS);
    expect(end).toBeLessThanOrEqual(Date.now() + 2 * DAY_MS);
  });

  it.each<ReferralStatus>(['sent', 'given-to-patient'])(
    'records the copy on a %s referral without changing its status or restarting the clock',
    async (status) => {
      mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

      const result = await run({ action: 'given-to-patient' });

      expect(result.statusCode).toBe(200);
      expect(getReferralDetails(savedReferral())).toMatchObject({ status, givenToPatientAt: expect.any(String) });
      expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
      expect(JSON.parse(result.body).referral).toMatchObject({ status, givenToPatientAt: expect.any(String) });
    }
  );

  it.each<ReferralStatus>(['response-received', 'closed', 'cancelled'])(
    'refuses to give a %s referral to the patient',
    async (status) => {
      mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

      const result = await run({ action: 'given-to-patient' });

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).code).toBe(APIErrorCode.INVALID_INPUT);
      expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
    }
  );

  it('writes against the version it read and reports a concurrent edit as a precondition failure', async () => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn('sent'));
    mockOystehr.fhir.update.mockRejectedValue(Object.assign(new Error('conflict'), { code: 412 }));

    const result = await run({ action: 'cancel' });

    expect(mockOystehr.fhir.update.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '5' });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.PRECONDITION_FAILED);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('reports a ServiceRequest that is not a referral as not found', async () => {
    mockOystehr.fhir.get.mockResolvedValue({ ...referralIn('sent'), meta: {} });

    const result = await run({ action: 'cancel' });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });
});
