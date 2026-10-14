import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Operation } from 'fast-json-patch';
import { Task, TaskOutput } from 'fhir/r4b';
import { FAX_PACKET_REQUEST_TASK_INPUT, FaxPacketTaskPayload } from 'utils/lib/types/api/fax.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';
import { createMockSecrets } from './validate-request-parameters/helpers';

const mockFhirGet = vi.fn();
const mockFhirPatch = vi.fn();
const mockOystehrClient = { fhir: { get: mockFhirGet, patch: mockFhirPatch } };

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createClinicalOystehrClient: vi.fn(() => mockOystehrClient),
}));

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../src/shared/errors', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  sendErrors: vi.fn().mockResolvedValue(undefined),
}));

const mockResolveFaxPacketPlan = vi.fn();
vi.mock('../../src/shared/fax/resolve-fax-source', () => ({
  resolveFaxPacketPlan: (...args: unknown[]) => mockResolveFaxPacketPlan(...args),
}));

const mockDeliverFaxPacket = vi.fn();
vi.mock('../../src/shared/fax/run-fax-packet', () => ({
  deliverFaxPacket: (...args: unknown[]) => mockDeliverFaxPacket(...args),
  savePcpIfRequested: vi.fn(),
}));

import { FaxPacketTooLargeError } from '../../src/shared/fax/build-fax-packet';
import { index } from '../../src/subscriptions/task/sub-send-fax-packet';

const handler = index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const SIZE_ERROR = new FaxPacketTooLargeError(
  'Fax packet source documents are over 21.3 MB, which exceeds the 20 MB limit. ' +
    'Fax the needed documents individually instead.'
);

const payload: FaxPacketTaskPayload = {
  source: { type: 'medical-record', patientId: 'patient-1' },
  recipients: [{ faxNumber: '+12125551234' }],
  senderPractitionerId: 'practitioner-1',
  senderUserId: 'user-1',
};

const task: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'order',
  input: [{ type: { coding: [FAX_PACKET_REQUEST_TASK_INPUT] }, valueString: JSON.stringify(payload) }],
};

const runHandler = (): Promise<APIGatewayProxyResult> =>
  handler({ headers: null, body: JSON.stringify(task), secrets: createMockSecrets() });

const describePatch = (operations: Operation[]): string => {
  const status = operations.find((op) => op.path === '/status') as { value: string } | undefined;
  if (status) return `status:${status.value}`;
  const output = operations.find((op) => op.path === '/output') as { value: TaskOutput[] } | undefined;
  return `output:${output?.value[0].type.coding?.[0].code}`;
};

const patchedLabels = (): string[] =>
  mockFhirPatch.mock.calls.map(([{ operations }]) => describePatch(operations as Operation[]));

const failedStatusReason = (): string | undefined => {
  const call = mockFhirPatch.mock.calls.find(
    ([{ operations }]) => describePatch(operations as Operation[]) === 'status:failed'
  );
  const reason = (call?.[0].operations as Operation[] | undefined)?.find((op) => op.path === '/statusReason') as
    | { value: { text: string } }
    | undefined;
  return reason?.value.text;
};

describe('sub-send-fax-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirGet.mockResolvedValue({});
    mockFhirPatch.mockResolvedValue({});
  });

  it('saves the too-large reason before the task is marked failed', async () => {
    const events: string[] = [];
    mockFhirPatch.mockImplementation(async ({ operations }: { operations: Operation[] }) => {
      const label = describePatch(operations);
      events.push(`${label} started`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      events.push(`${label} saved`);
      return {};
    });
    mockResolveFaxPacketPlan.mockRejectedValue(SIZE_ERROR);

    await runHandler();

    expect(events).toEqual([
      'status:in-progress started',
      'status:in-progress saved',
      'output:failure-reason started',
      'output:failure-reason saved',
      'status:failed started',
      'status:failed saved',
    ]);
    expect(failedStatusReason()).toBe(SIZE_ERROR.message);
  });

  it('records no reason when a lookup fails before the packet turns out too large', async () => {
    let rejectPlan!: (error: unknown) => void;
    mockResolveFaxPacketPlan.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPlan = reject;
      })
    );
    mockFhirGet.mockRejectedValue(new Error('Organization lookup failed'));

    await runHandler();
    rejectPlan(SIZE_ERROR);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(patchedLabels()).toEqual(['status:in-progress', 'status:failed']);
    expect(failedStatusReason()).toBe('Organization lookup failed');
  });

  it('keeps the size error as the failure when saving the reason fails', async () => {
    mockFhirPatch.mockImplementation(async ({ operations }: { operations: Operation[] }) => {
      if (describePatch(operations) === 'output:failure-reason') throw new Error('Task patch failed');
      return {};
    });
    mockResolveFaxPacketPlan.mockRejectedValue(SIZE_ERROR);

    await runHandler();

    expect(patchedLabels()).toEqual(['status:in-progress', 'output:failure-reason', 'status:failed']);
    expect(failedStatusReason()).toBe(SIZE_ERROR.message);
  });

  it('records too-large when the final packet exceeds the limit during delivery', async () => {
    const finalSizeError = new FaxPacketTooLargeError(
      'Fax packet is 20.1 MB, which exceeds the 20 MB limit. Fax the needed documents individually instead.'
    );
    mockResolveFaxPacketPlan.mockResolvedValue({ patient: { resourceType: 'Patient', id: 'patient-1' } });
    mockDeliverFaxPacket.mockRejectedValue(finalSizeError);

    await runHandler();

    expect(mockDeliverFaxPacket).toHaveBeenCalled();
    expect(patchedLabels()).toEqual(['status:in-progress', 'output:failure-reason', 'status:failed']);
    expect(failedStatusReason()).toBe(finalSizeError.message);
  });
});
