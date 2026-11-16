import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  search: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  getUser: mocks.getUser,
}));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => ({ fhir: { search: mocks.search, patch: mocks.patch } })),
}));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index } from '../../src/ehr/complete-erx-task';

const TASK_ID = '5f1c3c3e-7a1e-4f3b-9d1e-2a6b8c9d0e1f';
const STAFF = { id: 'user-1', name: 'ann.lee@example.com', profile: 'Practitioner/prac-1' };
const PATIENT_USER = { id: 'user-2', name: '+15555550123', profile: 'Patient/patient-1' };
const task = (category: string): Task => ({
  resourceType: 'Task',
  id: TASK_ID,
  status: 'requested',
  intent: 'order',
  groupIdentifier: { value: category },
});
const found = (tasks: Task[]): { unbundle: () => Task[] } => ({ unbundle: () => tasks });
const call = (): Promise<unknown> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(createMockZambdaInput({ taskId: TASK_ID }));

// Decisions 19/67/88: any staff member completes an eRx task, a patient user never does, and a caller can't tell a
// missing task from another kind of task.
describe('complete-erx-task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue(STAFF);
    mocks.patch.mockResolvedValue({});
  });

  it('completes an eRx task for any staff member, assigned or not', async () => {
    mocks.search.mockResolvedValue(found([task('erx')]));
    await expect(call()).resolves.toMatchObject({ statusCode: 200 });
    expect(mocks.patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: TASK_ID,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });
  });

  it('refuses a patient user before looking the task up', async () => {
    mocks.getUser.mockResolvedValue(PATIENT_USER);
    await expect(call()).rejects.toEqual(NOT_AUTHORIZED);
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('gives the same error for a missing task and a task of another kind', async () => {
    mocks.search.mockResolvedValue(found([]));
    const missing = await call().catch((error) => error);
    mocks.search.mockResolvedValue(found([task('inbound-fax')]));
    const other = await call().catch((error) => error);
    expect(missing).toEqual(FHIR_RESOURCE_NOT_FOUND('Task'));
    expect(other).toEqual(missing);
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
