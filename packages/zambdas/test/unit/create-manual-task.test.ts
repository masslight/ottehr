import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Practitioner, Task } from 'fhir/r4b';
import { getTaskInputValue, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyPractitionerId } from '../../src/shared/practitioners';
import type { ZambdaInput } from '../../src/shared/types/common';

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-m2m-token') };
});

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => oystehr) };
});

vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

vi.mock('../../src/shared/practitioners', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getMyPractitionerId: vi.fn() };
});

const oystehr = {
  fhir: {
    get: vi.fn(),
    create: vi.fn(async (task: Task) => ({ ...task, id: 'task-1' })),
  },
};

const { index: createManualTask } = (await import('../../src/ehr/tasks/create-manual-task/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const tokenFor = (sub: string): string =>
  [{ alg: 'none' }, { sub }].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.';

const createAs = (sub: string, body: Record<string, unknown> = {}): Promise<APIGatewayProxyResult> =>
  createManualTask({
    headers: { Authorization: `Bearer ${tokenFor(sub)}` },
    body: JSON.stringify({
      category: MANUAL_TASK.category.patientFollowUp,
      taskTitle: 'Call the patient back',
      location: { id: 'loc-1', name: 'Main clinic' },
      ...body,
    }),
    secrets: {},
  });

const createdTask = (): Task => oystehr.fhir.create.mock.calls[0][0];

describe('create-manual-task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the staff member who created the task as its requester', async () => {
    vi.mocked(getMyPractitionerId).mockResolvedValue('practitioner-1');
    const practitioner: Practitioner = { resourceType: 'Practitioner', name: [{ given: ['Jane'], family: 'Smith' }] };
    oystehr.fhir.get.mockResolvedValue(practitioner);

    const result = await createAs('auth0|staff-user');

    expect(result.statusCode).toBe(200);
    expect(createdTask().requester).toEqual({ reference: 'Practitioner/practitioner-1', display: 'Jane Smith' });
    expect(getTaskInputValue(createdTask(), MANUAL_TASK.input.providerName)).toBe('Jane Smith');
  });

  it('records no requester for an M2M caller, which has no practitioner of its own', async () => {
    const result = await createAs('m2m-client-1@clients', { createdBy: 'Billing integration' });

    expect(result.statusCode).toBe(200);
    expect(getMyPractitionerId).not.toHaveBeenCalled();
    expect(createdTask().requester).toBeUndefined();
    expect(getTaskInputValue(createdTask(), MANUAL_TASK.input.providerName)).toBe('Billing integration');
  });
});
