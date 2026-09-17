import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { applyPatch } from 'fast-json-patch';
import { Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as createTask } from '../../../src/billing/create-billing-claim-task/index';
import { index as retryTask } from '../../../src/billing/retry-billing-claim-task';
import { createBillingClient } from '../../../src/billing/shared';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
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
  secrets: { ENVIRONMENT: 'local' },
});
const invoke = (handler: typeof createTask, body: unknown): Promise<APIGatewayProxyResult> =>
  (handler as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(input(body));
const statuses = (): string[] => billing.fhir.patch.mock.calls.map(([request]) => request.operations[0].value);

describe('billing claim tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clinical.fhir.search.mockResolvedValue({
      unbundle: () => [{ resourceType: 'Encounter', id: encounterId, subject: { reference: 'Patient/patient-1' } }],
    });
    billing.fhir.create.mockImplementation(async (resource) => ({ ...resource, id: task.id }));
    billing.fhir.search.mockResolvedValue({ unbundle: () => [{ ...task, status: 'failed' }] });
    billing.fhir.patch.mockResolvedValue(undefined);
    createClaim.mockResolvedValue({ claimId: 'claim-1' });
  });

  it('creates a billing-owned task with clinical references and a creation timestamp', async () => {
    const response = await invoke(createTask, { encounterId });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ taskId: task.id });
    expect(createBillingClient).toHaveBeenCalledWith('token', input(null).secrets);
    expect(clinical.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      params: [{ name: '_id', value: encounterId }],
    });
    expect(billing.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        status: 'requested',
        code: { coding: [BILLING_CLAIM_TASK_CODING] },
        for: { reference: 'Patient/patient-1' },
        encounter: task.encounter,
        authoredOn: expect.any(String),
      })
    );
    expect(createClaim).not.toHaveBeenCalled();
  });

  it.each([{}, { encounterId: 'invalid' }])('rejects invalid input before accessing FHIR: %j', async (body) => {
    expect((await invoke(createTask, body)).statusCode).toBe(400);
    expect(clinical.fhir.search).not.toHaveBeenCalled();
    expect(billing.fhir.create).not.toHaveBeenCalled();
  });

  it('does not enqueue a nonexistent encounter', async () => {
    clinical.fhir.search.mockResolvedValueOnce({ unbundle: () => [] });
    const response = await invoke(createTask, { encounterId });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(FHIR_RESOURCE_NOT_FOUND('Encounter'));
    expect(billing.fhir.create).not.toHaveBeenCalled();
  });

  it('creates the claim and records progress and completion through the billing client', async () => {
    expect((await invoke(runTask, task)).statusCode).toBe(200);
    expect(createClaim).toHaveBeenCalledWith({ encounterId, secrets: input(null).secrets });
    expect(statuses()).toEqual(['in-progress', 'completed']);
    expect(createClinicalOystehrClient).not.toHaveBeenCalled();
    expect(clinical.fhir.patch).not.toHaveBeenCalled();
  });

  it.each([undefined, `Patient/${encounterId}`, 'Encounter/invalid'])(
    'fails tasks with an invalid encounter reference: %s',
    async (reference) => {
      expect((await invoke(runTask, { ...task, encounter: { reference } })).statusCode).toBe(400);
      expect(createClaim).not.toHaveBeenCalled();
      expect(statuses()).toEqual(['in-progress', 'failed']);
    }
  );

  it.each([new Error('Unable to create claim'), INVALID_INPUT_ERROR('Service facility not found')])(
    'records the failure message and supports a subsequent retry: $message',
    async (error) => {
      createClaim.mockRejectedValueOnce(error);
      expect((await invoke(runTask, task)).statusCode).toBeGreaterThanOrEqual(400);
      expect(statuses()).toEqual(['in-progress', 'failed']);
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      expect(billing.fhir.patch.mock.lastCall?.[0].operations[1].value.text).toBe(reason);
      expect((await invoke(runTask, task)).statusCode).toBe(200);
      expect(statuses()).toEqual(['in-progress', 'failed', 'in-progress', 'completed']);
    }
  );

  it.each([undefined, { text: 'Service facility not found' }])(
    'requeues a failed task with reason %j',
    async (reason) => {
      const failedTask = { ...task, status: 'failed', ...(reason ? { statusReason: reason } : {}) };
      billing.fhir.search.mockResolvedValueOnce({ unbundle: () => [failedTask] });
      const response = await invoke(retryTask, { taskId: task.id });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ taskId: task.id });
      expect(billing.fhir.patch).toHaveBeenCalledTimes(1);
      const [request, options] = billing.fhir.patch.mock.calls[0];
      expect(request).toMatchObject({ resourceType: 'Task', id: task.id });
      expect(options).toEqual({ optimisticLockingVersionId: '3' });
      expect(applyPatch(structuredClone(failedTask), request.operations, true).newDocument).toEqual(task);
      expect(billing.fhir.create).not.toHaveBeenCalled();
      expect(createClaim).not.toHaveBeenCalled();
    }
  );

  it.each([{}, null, { taskId: 'invalid' }])('rejects invalid retry input: %j', async (body) => {
    expect((await invoke(retryTask, body)).statusCode).toBe(400);
    expect(billing.fhir.search).not.toHaveBeenCalled();
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { code: undefined },
    { code: { coding: [{ ...BILLING_CLAIM_TASK_CODING, code: 'send-claim' }] } },
    { code: { coding: [{ ...BILLING_CLAIM_TASK_CODING, system: 'https://example.com/other-task' }] } },
    { status: 'requested' },
    { status: 'in-progress' },
    { status: 'completed' },
    { status: 'cancelled' },
  ])('rejects missing, unrelated, or nonfailed retry tasks: %j', async (overrides) => {
    billing.fhir.search.mockResolvedValueOnce({
      unbundle: () => (overrides ? [{ ...task, status: 'failed', ...overrides }] : []),
    });
    expect((await invoke(retryTask, { taskId: task.id })).statusCode).toBe(400);
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });

  it('does not retry the write or report success on a version conflict', async () => {
    billing.fhir.patch.mockRejectedValueOnce(
      new Oystehr.OystehrSdkError({ message: 'Precondition Failed', code: 412 })
    );
    expect((await invoke(retryTask, { taskId: task.id })).statusCode).toBeGreaterThanOrEqual(400);
    expect(billing.fhir.patch).toHaveBeenCalledTimes(1);
    expect(billing.fhir.patch.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '3' });
  });

  it('preserves the clinical client and error format for existing task handlers', async () => {
    const error = INVALID_INPUT_ERROR('Existing failure');
    const legacyHandler = wrapTaskHandler('legacy-task', vi.fn().mockRejectedValue(error));
    expect((await invoke(legacyHandler, task)).statusCode).toBe(400);
    expect(clinical.fhir.patch.mock.lastCall?.[0].operations[1].value.text).toBe(JSON.stringify(error));
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });
});
