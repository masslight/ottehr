import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as createTask } from '../../../src/billing/create-billing-claim-task/index';
import { createBillingClient } from '../../../src/billing/shared';
import { createClinicalOystehrClient } from '../../../src/shared/helpers';
import { ZambdaInput } from '../../../src/shared/types/common';
import { wrapTaskHandler } from '../../../src/subscriptions/task/helpers';
import { index as runTask } from '../../../src/subscriptions/task/sub-billing-claim-task/index';

const { clinical, billing, createClaim } = vi.hoisted(() => ({
  clinical: { fhir: { search: vi.fn(), patch: vi.fn() } },
  billing: { fhir: { create: vi.fn(), patch: vi.fn() } },
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
  id: 'task-1',
  intent: 'order',
  status: 'requested',
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

  it('preserves the clinical client and error format for existing task handlers', async () => {
    const error = INVALID_INPUT_ERROR('Existing failure');
    const legacyHandler = wrapTaskHandler('legacy-task', vi.fn().mockRejectedValue(error));
    expect((await invoke(legacyHandler, task)).statusCode).toBe(400);
    expect(clinical.fhir.patch.mock.lastCall?.[0].operations[1].value.text).toBe(JSON.stringify(error));
    expect(billing.fhir.patch).not.toHaveBeenCalled();
  });
});
