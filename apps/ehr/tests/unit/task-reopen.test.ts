import Oystehr from '@oystehr/sdk';
import { applyPatch, Operation } from 'fast-json-patch';
import { Task as FhirTask } from 'fhir/r4b';
import { TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { DME_TASK } from 'utils/lib/types/api/dme.types';
import { PROVIDER_NOTIFICATION_TAG_SYSTEM } from 'utils/lib/types/api/practitioner.types';
import { IN_HOUSE_LAB_TASK } from 'utils/lib/types/data/in-house/in-house.constants';
import { LAB_ORDER_TASK } from 'utils/lib/types/data/labs/labs.constants';
import {
  ERX_TASK,
  FAX_TASK,
  MANUAL_TASK,
  PATIENT_REQUEST_TASK,
  RADIOLOGY_TASK,
} from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { fhirTaskToTask, reopenTaskVersionChecked } from '../../src/features/visits/in-person/hooks/useTasks';

const OWNER: FhirTask['owner'] = {
  reference: 'Practitioner/pr-1',
  display: 'Brooks, Samantha',
  extension: [{ url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL, valueDateTime: '2026-10-11T11:30:00.000Z' }],
};
const BOARD_TAG = { code: 'task' };
const ASSIGNMENT_NOTIFIED_TAG = { system: PROVIDER_NOTIFICATION_TAG_SYSTEM, code: 'task_assigned' };
const FILED = { coding: [{ system: FAX_TASK.system, code: FAX_TASK.businessStatus.filed }] };

const completedTask = (overrides: Partial<FhirTask> = {}): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'completed',
  intent: 'order',
  meta: { versionId: '1', tag: [BOARD_TAG, ASSIGNMENT_NOTIFIED_TAG] },
  groupIdentifier: { value: MANUAL_TASK.category.other },
  owner: OWNER,
  ...overrides,
});

const faxTask = (code: string, overrides: Partial<FhirTask> = {}): FhirTask =>
  completedTask({
    groupIdentifier: { value: FAX_TASK.category },
    code: { coding: [{ system: FAX_TASK.system, code }] },
    ...overrides,
  });

const fakeFhirServer = (
  initial: FhirTask
): {
  oystehr: Oystehr;
  get: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  stored: () => FhirTask;
  writeAsAnotherUser: (change: Partial<FhirTask>) => void;
} => {
  let stored = structuredClone(initial);
  const nextVersion = (): string => String(Number(stored.meta?.versionId) + 1);
  const writeAsAnotherUser = (change: Partial<FhirTask>): void => {
    stored = { ...stored, ...change, meta: { ...stored.meta, versionId: nextVersion() } };
  };
  const get = vi.fn(async () => structuredClone(stored));
  const transaction = vi.fn(
    async ({ requests: [request] }: { requests: { ifMatch?: string; resource: { data: string } }[] }) => {
      if (request.ifMatch && request.ifMatch !== `W/"${stored.meta?.versionId}"`) {
        throw new Oystehr.OystehrFHIRError({ code: 412, error: { resourceType: 'OperationOutcome', issue: [] } });
      }
      const operations: Operation[] = JSON.parse(atob(request.resource.data));
      const patched = applyPatch(structuredClone(stored), operations).newDocument;
      stored = { ...patched, meta: { ...patched.meta, versionId: nextVersion() } };
      return {};
    }
  );
  const oystehr = { fhir: { get, transaction } } as unknown as Oystehr;
  return { oystehr, get, transaction, stored: () => stored, writeAsAnotherUser };
};

describe('which completed tasks can be reopened', () => {
  it('is every manual category, eRx and patient-request tasks, whose completion only a person records', () => {
    const categories = [...Object.values(MANUAL_TASK.category), ERX_TASK.category, PATIENT_REQUEST_TASK.category];
    for (const category of categories) {
      expect(fhirTaskToTask(completedTask({ groupIdentifier: { value: category } })).reopenable).toBe(true);
    }
  });

  it('is never an inbound fax, filed or not, nor a task its order workflow completes', () => {
    const notReopenable = [
      faxTask(FAX_TASK.code.matchInboundFax),
      faxTask(FAX_TASK.code.matchInboundFax, { businessStatus: FILED }),
      faxTask(FAX_TASK.code.reviewInboundFax),
      ...[LAB_ORDER_TASK.category, IN_HOUSE_LAB_TASK.category, RADIOLOGY_TASK.category, DME_TASK.category].map(
        (category) => completedTask({ groupIdentifier: { value: category } })
      ),
    ];
    for (const task of notReopenable) {
      expect(fhirTaskToTask(task).reopenable).toBe(false);
    }
  });
});

describe('reopenTaskVersionChecked', () => {
  it.each([
    [
      'a fax without the filed marker (unfiled, or filed before the marker existed)',
      faxTask(FAX_TASK.code.matchInboundFax),
    ],
    ['a filed fax', faxTask(FAX_TASK.code.matchInboundFax, { businessStatus: FILED })],
    ['a fax review task', faxTask(FAX_TASK.code.reviewInboundFax)],
  ])('refuses %s, so it stays locked against filing and deletion', async (_name, task) => {
    for (const status of ['ready', 'in-progress'] as const) {
      const server = fakeFhirServer(task);

      await expect(reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status })).rejects.toThrow(
        /cannot be reopened/
      );
      expect(server.transaction).not.toHaveBeenCalled();
      expect(server.stored()).toEqual(task);
    }
  });

  it('returns to Pending unassigned, dropping the assignment notification marker, in one versioned write', async () => {
    const server = fakeFhirServer(completedTask());

    await reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'ready' });

    expect(server.transaction).toHaveBeenCalledTimes(1);
    const { requests } = server.transaction.mock.calls[0][0];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'PATCH', url: '/Task/task-1', ifMatch: 'W/"1"' });
    expect(server.stored().status).toBe('ready');
    expect(server.stored().owner).toBeUndefined();
    expect(server.stored().meta?.tag).toEqual([BOARD_TAG]);
  });

  it('returns an unassigned task to Pending', async () => {
    const server = fakeFhirServer(completedTask({ owner: undefined, meta: { versionId: '1', tag: [BOARD_TAG] } }));

    await reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'ready' });

    expect(server.stored().status).toBe('ready');
    expect(server.stored().owner).toBeUndefined();
  });

  it('returns to In Progress keeping the assignee and the marker that stops a second assignment notification', async () => {
    const server = fakeFhirServer(completedTask());

    await reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'in-progress' });

    expect(server.stored().status).toBe('in-progress');
    expect(server.stored().owner).toEqual(OWNER);
    expect(server.stored().meta?.tag).toEqual([BOARD_TAG, ASSIGNMENT_NOTIFIED_TAG]);
  });

  it('refuses In Progress when the stored task has no assignee', async () => {
    const server = fakeFhirServer(completedTask({ owner: undefined }));

    await expect(reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'in-progress' })).rejects.toThrow(
      /no assignee/
    );
    expect(server.transaction).not.toHaveBeenCalled();
  });

  it('refuses a task someone else already reopened since the list was loaded', async () => {
    const server = fakeFhirServer(completedTask());
    server.writeAsAnotherUser({ status: 'ready', owner: undefined });
    const theirs = server.stored();

    await expect(reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'in-progress' })).rejects.toThrow(
      /changed by someone else/
    );
    expect(server.transaction).not.toHaveBeenCalled();
    expect(server.stored()).toEqual(theirs);
  });

  it('does not overwrite a change made between its read and its write', async () => {
    const server = fakeFhirServer(completedTask());
    server.get.mockImplementationOnce(async () => {
      const read = structuredClone(server.stored());
      server.writeAsAnotherUser({ owner: { reference: 'Practitioner/pr-2', display: 'Grace, Lina' } });
      return read;
    });
    const theirs = (): FhirTask => server.stored();

    await expect(reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'in-progress' })).rejects.toThrow(
      /changed by someone else/
    );
    expect(theirs().status).toBe('completed');
    expect(theirs().owner?.reference).toBe('Practitioner/pr-2');
  });

  it('lets only one of two simultaneous reopenings through, leaving a consistent task', async () => {
    const server = fakeFhirServer(completedTask());

    const results = await Promise.allSettled([
      reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'ready' }),
      reopenTaskVersionChecked(server.oystehr, { taskId: 'task-1', status: 'in-progress' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [refused] = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(refused.reason.message).toMatch(/changed by someone else/);
    const task = server.stored();
    if (task.status === 'ready') {
      expect(task.owner).toBeUndefined();
    } else {
      expect(task.status).toBe('in-progress');
      expect(task.owner).toEqual(OWNER);
    }
  });
});
