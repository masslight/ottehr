import { Task, TaskOutput } from 'fhir/r4b';
import {
  FAX_PACKET_FAILURE_TASK_OUTPUT,
  FAX_PACKET_RESULTS_TASK_OUTPUT,
  FaxRecipientResult,
  GetFaxPacketStatusOutput,
} from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSecrets, createMockZambdaInput } from './validate-request-parameters/helpers';

const mockFhirGet = vi.fn();
const mockOystehrClient = { fhir: { get: mockFhirGet } };

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  getUser: vi.fn().mockResolvedValue({ id: 'user-1', profile: 'Practitioner/prac-1' }),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

import { index } from '../../src/ehr/get-fax-packet-status';

const TASK_ID = '650e8400-e29b-41d4-a716-446655440001';

const failureReasonOutput = (value: string): TaskOutput => ({
  type: { coding: [FAX_PACKET_FAILURE_TASK_OUTPUT] },
  valueString: value,
});

const sentRecipient: FaxRecipientResult = { faxNumber: '+12125551234', status: 'sent' };

const statusFor = async (task: Pick<Task, 'status' | 'output'>): Promise<GetFaxPacketStatusOutput> => {
  mockFhirGet.mockResolvedValue({ resourceType: 'Task', id: TASK_ID, intent: 'order', ...task });
  const result: any = await (index as any)(
    createMockZambdaInput({ taskId: TASK_ID }, { secrets: createMockSecrets() })
  );
  return JSON.parse(result.body);
};

describe('get-fax-packet-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports too-large for a failed task that recorded it', async () => {
    const status = await statusFor({ status: 'failed', output: [failureReasonOutput('too-large')] });

    expect(status).toEqual({ jobStatus: 'failed', recipients: [], failureReason: 'too-large' });
  });

  it('omits the reason for a completed task', async () => {
    const status = await statusFor({
      status: 'completed',
      output: [
        failureReasonOutput('too-large'),
        { type: { coding: [FAX_PACKET_RESULTS_TASK_OUTPUT] }, valueString: JSON.stringify([sentRecipient]) },
      ],
    });

    expect(status).toEqual({ jobStatus: 'completed', recipients: [sentRecipient] });
  });

  it('omits a reason it does not recognize', async () => {
    const status = await statusFor({ status: 'failed', output: [failureReasonOutput('too-many-pages')] });

    expect(status).toEqual({ jobStatus: 'failed', recipients: [] });
  });
});
