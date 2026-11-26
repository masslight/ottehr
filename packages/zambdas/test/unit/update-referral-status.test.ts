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

const { mockOystehr, mockCaptureException } = vi.hoisted(() => ({
  mockOystehr: { fhir: { get: vi.fn(), search: vi.fn(), update: vi.fn(), patch: vi.fn(), transaction: vi.fn() } },
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

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { index as rawIndex } from '../../src/ehr/referrals/update-referral-status';
import { requireUserWithRole } from '../../src/shared/auth';

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

interface TransactionRequest {
  method: string;
  url: string;
  resource: ServiceRequest | { data: string };
  ifMatch?: string;
}
const transactionRequests = (): TransactionRequest[] => mockOystehr.fhir.transaction.mock.calls[0][0].requests;
const savedReferral = (): ServiceRequest => transactionRequests()[0].resource as ServiceRequest;
const taskPatches = (): { url: string; operations: { op: string; path: string; value: any }[] }[] =>
  transactionRequests()
    .filter((request) => request.method === 'PATCH')
    .map((request) => ({
      url: request.url,
      operations: JSON.parse(Buffer.from((request.resource as { data: string }).data, 'base64').toString()),
    }));
const expectNothingWrittenOutsideTheTransaction = (): void => {
  expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
};

describe('update-referral-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The referral is tagged `referral` by makeReferralServiceRequest; the open task is found by every task search.
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Task' ? [openTask] : []),
    }));
    mockOystehr.fhir.transaction.mockImplementation(async ({ requests }: { requests: TransactionRequest[] }) => ({
      entry: requests.map((request) => ({ resource: request.method === 'PUT' ? request.resource : openTask })),
    }));
  });

  describe.each<ReferralStatus>(['not-sent', 'sent', 'given-to-patient', 'response-received'])('from %s', (status) => {
    it('closes the referral with the reason and completes its task in the same transaction', async () => {
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
      expect(transactionRequests()[0]).toMatchObject({
        method: 'PUT',
        url: `/ServiceRequest/${REFERRAL_ID}`,
        ifMatch: 'W/"5"',
      });
      expect(taskPatches()).toEqual([
        { url: '/Task/task-1', operations: [{ op: 'replace', path: '/status', value: 'completed' }] },
      ]);
      expectNothingWrittenOutsideTheTransaction();
      expect(JSON.parse(result.body).referral).toMatchObject({ id: REFERRAL_ID, status: 'closed' });
    });

    it('cancels the referral and cancels its task in the same transaction', async () => {
      mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

      const result = await run({ action: 'cancel' });

      expect(result.statusCode).toBe(200);
      expect(getReferralDetails(savedReferral())).toMatchObject({ status: 'cancelled', closedAt: expect.any(String) });
      expect(taskPatches()).toEqual([
        { url: '/Task/task-1', operations: [{ op: 'replace', path: '/status', value: 'cancelled' }] },
      ]);
      expectNothingWrittenOutsideTheTransaction();
    });
  });

  it.each<ReferralStatus>(['closed', 'cancelled'])('refuses to close or cancel a %s referral', async (status) => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn(status));

    for (const body of [{ action: 'close', reason: 'reviewed' }, { action: 'cancel' }]) {
      const result = await run(body);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).code).toBe(APIErrorCode.INVALID_INPUT);
    }
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('marks a not-sent referral given to the patient and starts the task clock from now, in one transaction', async () => {
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
    expectNothingWrittenOutsideTheTransaction();
    expect(taskPatches()).toHaveLength(1);
    const [{ operations }] = taskPatches();
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
      expect(taskPatches()).toEqual([]);
      expectNothingWrittenOutsideTheTransaction();
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
      expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
    }
  );

  it.each<ReferralStatus>(['sent', 'given-to-patient'])(
    'keeps the first hand-over date and person when a %s referral is given to the patient again',
    async (status) => {
      const first = {
        givenToPatientAt: '2026-11-02T10:00:00.000Z',
        givenToPatientBy: { id: 'prac-9', name: 'A. First' },
      };
      mockOystehr.fhir.get.mockResolvedValue(withReferralDetails(referralIn(status), first));

      const result = await run({ action: 'given-to-patient' });

      expect(result.statusCode).toBe(200);
      expect(getReferralDetails(savedReferral())).toMatchObject({ status, ...first });
      expect(JSON.parse(result.body).referral).toMatchObject(first);
    }
  );

  it.each([
    { action: 'close', reason: 'patient-seen', from: 'sent', recorded: 'closedBy' },
    { action: 'cancel', from: 'not-sent', recorded: 'closedBy' },
    { action: 'given-to-patient', from: 'not-sent', recorded: 'givenToPatientBy' },
    { action: 'given-to-patient', from: 'sent', recorded: 'givenToPatientBy' },
  ] as const)('records who made the change: $action from $from', async ({ from, recorded, ...body }) => {
    // Spec: every status change made by staff or a provider records who made it and when, named like "Created by".
    const practitioner = {
      resourceType: 'Practitioner',
      id: 'prac-1',
      name: [{ given: ['Sam'], family: 'Staff', suffix: ['RN'] }],
    };
    mockOystehr.fhir.get.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Practitioner' ? practitioner : referralIn(from)
    );

    const result = await run(body);

    expect(result.statusCode).toBe(200);
    expect(getReferralDetails(savedReferral())?.[recorded]).toEqual({ id: 'prac-1', name: 'Sam Staff, RN' });
    expect(JSON.parse(result.body).referral[recorded]).toEqual({ id: 'prac-1', name: 'Sam Staff, RN' });
  });

  it('records a user without a Practitioner profile by their user name', async () => {
    vi.mocked(requireUserWithRole).mockResolvedValueOnce({
      id: 'user-2',
      name: 'front.desk@example.com',
      profile: 'Device/user-2',
    } as Awaited<ReturnType<typeof requireUserWithRole>>);
    mockOystehr.fhir.get.mockResolvedValue(referralIn('sent'));

    const result = await run({ action: 'cancel' });

    expect(result.statusCode).toBe(200);
    expect(getReferralDetails(savedReferral())?.closedBy).toEqual({ name: 'front.desk@example.com' });
  });

  it('writes against the version it read and reports a concurrent edit as a precondition failure', async () => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn('sent'));
    mockOystehr.fhir.transaction.mockRejectedValue(Object.assign(new Error('conflict'), { code: 412 }));

    const result = await run({ action: 'cancel' });

    expect(transactionRequests()[0].ifMatch).toBe('W/"5"');
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.PRECONDITION_FAILED);
    expectNothingWrittenOutsideTheTransaction();
  });

  it('leaves the referral open when its task cannot be settled, since both are written by one transaction', async () => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn('sent'));
    mockOystehr.fhir.transaction.mockRejectedValue(new Error('Task patch failed'));

    const result = await run({ action: 'close', reason: 'reviewed' });

    expect(result.statusCode).toBe(500);
    expect(transactionRequests().map((request) => request.url)).toEqual([
      `/ServiceRequest/${REFERRAL_ID}`,
      '/Task/task-1',
    ]);
    expectNothingWrittenOutsideTheTransaction();
  });

  it('reports a committed close as done even when the response cannot be filled in, as a retry would be refused', async () => {
    mockOystehr.fhir.get.mockResolvedValue(referralIn('sent'));
    const failure = new Error('DocumentReference search failed');
    mockOystehr.fhir.search.mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (mockOystehr.fhir.transaction.mock.calls.length > 0) throw failure;
      return { unbundle: () => (resourceType === 'Task' ? [openTask] : []) };
    });

    const result = await run({ action: 'close', reason: 'patient-seen' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).referral).toMatchObject({ id: REFERRAL_ID, status: 'closed' });
    expect(mockCaptureException).toHaveBeenCalledWith(failure);
  });

  it('reports a ServiceRequest that is not a referral as not found', async () => {
    mockOystehr.fhir.get.mockResolvedValue({ ...referralIn('sent'), meta: {} });

    const result = await run({ action: 'cancel' });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });
});
