import { APIGatewayProxyResult } from 'aws-lambda';
import { applyPatch } from 'fast-json-patch';
import { Task } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils/lib/fhir/constants';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as createTask } from '../../../src/billing/create-billing-claim-task/index';
import { index as retryTask } from '../../../src/billing/retry-billing-claim-task';
import { index as searchTasks } from '../../../src/billing/search-billing-claim-tasks';
import { ZambdaInput } from '../../../src/shared/types/common';
import { wrapTaskHandler } from '../../../src/subscriptions/task/helpers';
import { index as runTask } from '../../../src/subscriptions/task/sub-billing-claim-task/index';

const { clinical, billing, createClaim } = vi.hoisted(() => ({
  clinical: { fhir: { search: vi.fn(), patch: vi.fn() } },
  billing: { fhir: { search: vi.fn(), create: vi.fn(), patch: vi.fn() } },
  createClaim: vi.fn(),
}));
vi.mock('../../../src/shared/auth', async (original) => ({
  ...(await original<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../../src/shared/helpers', async (original) => ({
  ...(await original<object>()),
  createClinicalOystehrClient: vi.fn(() => clinical),
}));
vi.mock('../../../src/billing/shared', async (original) => ({
  ...(await original<object>()),
  createBillingClient: vi.fn(() => billing),
}));
vi.mock('../../../src/billing/create-billing-claim-from-encounter/handler', () => ({
  createClaimFromEncounter: createClaim,
}));
vi.mock('../../../src/shared/errors', () => ({ sendErrors: vi.fn() }));

const encounterId = 'ed184c50-8001-4e45-89b9-ef848dfda958';
const task: Task = {
  resourceType: 'Task',
  id: '6e13dbad-28d0-4d5b-8554-59ed0077ca35',
  meta: { versionId: '3' },
  intent: 'order',
  status: 'requested',
  code: { coding: [BILLING_CLAIM_TASK_CODING] },
  authoredOn: '2026-09-01T12:00:00Z',
  encounter: { reference: `Encounter/${encounterId}` },
};
const input = (body: unknown): ZambdaInput => ({
  headers: null,
  body: JSON.stringify(body),
  secrets: { ENVIRONMENT: 'local', PROJECT_ID: 'project-1' },
});
const invoke = (handler: typeof createTask, body: unknown): Promise<APIGatewayProxyResult> =>
  (handler as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(input(body));
const statuses = (): string[] => billing.fhir.patch.mock.calls.map(([request]) => request.operations[0].value);

describe('billing claim tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clinical.fhir.search.mockImplementation(async ({ resourceType }) => ({
      unbundle: () =>
        resourceType === 'Encounter'
          ? [{ resourceType: 'Encounter', id: encounterId, subject: { reference: 'Patient/patient-1' } }]
          : [],
    }));
    billing.fhir.create.mockImplementation(async (resource) => ({ ...resource, id: task.id }));
    billing.fhir.search.mockResolvedValue({ unbundle: () => [{ ...task, status: 'failed' }] });
    billing.fhir.patch.mockResolvedValue(undefined);
    createClaim.mockResolvedValue({ claimId: 'claim-1' });
  });

  it('creates a billing-owned task with clinical references and a creation timestamp', async () => {
    billing.fhir.search.mockResolvedValue({ unbundle: () => [] });
    const response = await invoke(createTask, { encounterId });
    expect(response.statusCode).toBe(200);
    expect(billing.fhir.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        resourceType: 'Task',
        status: 'requested',
        code: { coding: [BILLING_CLAIM_TASK_CODING] },
        for: { reference: 'Patient/patient-1' },
        encounter: task.encounter,
        authoredOn: expect.any(String),
      })
    );
    const { ifNoneExist } = billing.fhir.create.mock.calls[0][1];
    expect(ifNoneExist).toContainEqual({ name: 'encounter', value: task.encounter?.reference });
    expect(createClaim).not.toHaveBeenCalled();
  });

  it.each(['Claim', 'Task'])('reuses an existing %s instead of enqueueing again', async (type) => {
    billing.fhir.search.mockImplementation(async ({ resourceType }) => ({
      unbundle: () => (resourceType === type ? [{ resourceType, id: 'existing' }] : []),
    }));
    const response = await invoke(createTask, { encounterId });
    expect(JSON.parse(response.body)).toEqual({ [type === 'Claim' ? 'claimId' : 'taskId']: 'existing' });
    expect(billing.fhir.create).not.toHaveBeenCalled();
  });

  it.each([new Error('Unable to create claim'), INVALID_INPUT_ERROR('Service facility not found')])(
    'shows a failed task even without clinical records and retries it: $message',
    async (error) => {
      createClaim.mockRejectedValueOnce(error);
      expect((await invoke(runTask, task)).statusCode).toBeGreaterThanOrEqual(400);
      expect(statuses()).toEqual(['in-progress', 'failed']);
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      expect(billing.fhir.patch.mock.lastCall?.[0].operations[1].value.text).toBe(reason);

      const failedTask = { ...task, status: 'failed', statusReason: { text: reason } };
      billing.fhir.search.mockResolvedValue({ unbundle: () => [failedTask], total: 1 });
      clinical.fhir.search.mockResolvedValue({ unbundle: () => [] });
      const listed = JSON.parse((await invoke(searchTasks, {})).body);
      expect(listed.tasks).toMatchObject([{ id: task.id, status: 'failed', error: error.message }]);

      expect((await invoke(retryTask, { taskId: task.id })).statusCode).toBe(200);
      const [request, options] = billing.fhir.patch.mock.lastCall!;
      expect(options).toEqual({ optimisticLockingVersionId: '3' });
      expect(applyPatch(structuredClone(failedTask), request.operations, true).newDocument).toEqual(task);
      expect(billing.fhir.create).not.toHaveBeenCalled();
      expect((await invoke(runTask, task)).statusCode).toBe(200);
      expect(statuses()).toEqual(['in-progress', 'failed', 'requested', 'in-progress', 'completed']);
      expect(createClaim).toHaveBeenCalledTimes(2);
      expect(createClaim).toHaveBeenCalledWith({ encounterId, secrets: input(null).secrets });
      expect(clinical.fhir.patch).not.toHaveBeenCalled();
    }
  );

  it.each([
    undefined,
    { code: { coding: [{ ...BILLING_CLAIM_TASK_CODING, code: 'send-claim' }] } },
    { code: { coding: [{ ...BILLING_CLAIM_TASK_CODING, system: 'https://example.com/other-task' }] } },
    { status: 'in-progress' },
    { status: 'completed' },
  ])('rejects missing, unrelated, or nonfailed retry tasks: %j', async (overrides) => {
    billing.fhir.search.mockResolvedValueOnce({
      unbundle: () => (overrides ? [{ ...task, status: 'failed', ...overrides }] : []),
    });
    expect((await invoke(retryTask, { taskId: task.id })).statusCode).toBe(400);
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });

  it('joins clinical names and visit dates by ID with one lookup per resource type', async () => {
    const first = { ...task, for: { reference: 'Patient/p1' } };
    const second = {
      ...task,
      id: 'task-2',
      for: { reference: 'Patient/p2' },
      encounter: { reference: 'Encounter/e2' },
    };
    billing.fhir.search.mockResolvedValueOnce({
      unbundle: () => [first, second, { ...first, id: 'task-3' }],
      total: 3,
    });
    clinical.fhir.search.mockResolvedValueOnce({
      unbundle: () => [
        { resourceType: 'Encounter', id: 'e2', period: { start: '2026-09-02T12:00:00Z' } },
        { resourceType: 'Appointment', id: 'a1', start: '2026-09-01T09:00:00Z' },
        {
          resourceType: 'Encounter',
          id: encounterId,
          appointment: [{ reference: 'Appointment/a1' }],
          period: { start: '2026-09-01T09:15:00Z' },
        },
      ],
    });
    clinical.fhir.search.mockResolvedValueOnce({
      unbundle: () => [
        { resourceType: 'Patient', id: 'p2', name: [{ family: 'Jones', given: ['Ben'] }] },
        { resourceType: 'Patient', id: 'p1', name: [{ family: 'Smith', given: ['Amy'] }] },
      ],
    });
    const response = await invoke(searchTasks, {});
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).tasks).toMatchObject([
      { id: task.id, patientName: 'Smith, Amy', encounterDate: '2026-09-01T09:00:00Z', appointmentId: 'a1' },
      { id: 'task-2', patientName: 'Jones, Ben', encounterDate: '2026-09-02T12:00:00Z' },
      { id: 'task-3', patientName: 'Smith, Amy', encounterDate: '2026-09-01T09:00:00Z', appointmentId: 'a1' },
    ]);
    expect(clinical.fhir.search).toHaveBeenCalledTimes(2);
    expect(clinical.fhir.search.mock.calls.map(([request]) => request.resourceType)).toEqual(['Encounter', 'Patient']);
    expect(billing.fhir.search.mock.calls.map(([request]) => request.resourceType)).toEqual(['Task']);
    expect(clinical.fhir.patch).not.toHaveBeenCalled();
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });

  it('applies status, creation dates, patient, and pagination filters even on an empty page', async () => {
    const filters = {
      status: 'failed',
      createdFrom: '2026-09-01',
      createdTo: '2026-09-17',
      patientId: encounterId,
      patientIdentifier: '1000123',
      offset: 50,
      pageSize: 10,
    };
    billing.fhir.search.mockResolvedValueOnce({ unbundle: () => [], total: 38 });
    const response = await invoke(searchTasks, filters);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ tasks: [], total: 38, offset: 50, pageSize: 10 });
    expect(clinical.fhir.search).not.toHaveBeenCalled();
    expect(billing.fhir.search.mock.lastCall?.[0].params).toEqual(
      expect.arrayContaining([
        { name: 'code', value: `${BILLING_CLAIM_TASK_CODING.system}|${BILLING_CLAIM_TASK_CODING.code}` },
        { name: 'status', value: 'failed' },
        { name: 'authored-on', value: 'ge2026-09-01' },
        { name: 'authored-on', value: 'le2026-09-17' },
        { name: 'subject', value: `Patient/${encounterId}` },
        { name: 'subject:Patient.identifier', value: `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/project-1|1000123` },
        { name: '_count', value: '10' },
        { name: '_offset', value: '50' },
      ])
    );
  });

  it.each([
    { patientName: ' Amy  Smith ', terms: ['Amy', 'Smith'] },
    { patientName: 'Smith, Amy', terms: ['Smith', 'Amy'] },
    { patientName: 'mit', terms: ['mit'] },
    { patientName: 'A|B', terms: ['A\\|B'] },
  ])('filters by full or partial patient name before pagination: $patientName', async ({ patientName, terms }) => {
    billing.fhir.search.mockResolvedValueOnce({ unbundle: () => [], total: 0 });
    const response = await invoke(searchTasks, { patientName, offset: 25 });
    expect(response.statusCode).toBe(200);
    const filters = billing.fhir.search.mock.lastCall?.[0].params;
    expect(filters.filter(({ name }: { name: string }) => name === 'subject:Patient.name:contains')).toEqual(
      terms.map((value) => ({ name: 'subject:Patient.name:contains', value }))
    );
  });

  it('preserves the clinical client and error format for existing task handlers', async () => {
    const error = INVALID_INPUT_ERROR('Existing failure');
    const legacyHandler = wrapTaskHandler('legacy-task', vi.fn().mockRejectedValue(error));
    expect((await invoke(legacyHandler, task)).statusCode).toBe(400);
    expect(clinical.fhir.patch.mock.lastCall?.[0].operations[1].value.text).toBe(JSON.stringify(error));
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });
});
