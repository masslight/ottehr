import { Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  OttehrTaskSystem,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecentlyAssignedTasksMap } from '../../src/cron/notifications-updater';

const mockOystehr = {
  fhir: {
    search: vi.fn(),
  },
};

const fromDate = DateTime.utc().minus({ hours: 1 });
const recentDate = DateTime.utc().minus({ minutes: 5 }).toISO()!;
const oldDate = DateTime.utc().minus({ hours: 3 }).toISO()!;

const waitingRoomTask = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 'task-waiting',
  status: 'requested',
  intent: 'order',
  authoredOn: recentDate,
  code: {
    coding: [
      {
        system: OttehrTaskSystem,
        code: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
      },
    ],
  },
  ...overrides,
});

const erxTask = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 'task-erx',
  status: 'requested',
  intent: 'order',
  authoredOn: recentDate,
  code: {
    coding: [
      {
        system: OttehrTaskSystem,
        code: 'some-other-code',
      },
    ],
  },
  ...overrides,
});

const makePractitioner = (id: string): Practitioner => ({
  resourceType: 'Practitioner',
  id,
});

const mockSearch = (resources: (Task | Practitioner)[]): void => {
  mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => resources });
};

describe('getRecentlyAssignedTasksMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes a waiting-room Task with no owner when authoredOn is within the window', async () => {
    mockSearch([waitingRoomTask()]);

    const result = await getRecentlyAssignedTasksMap(mockOystehr as any, fromDate);
    expect(result['task-waiting']).toBeDefined();
    expect(result['task-waiting'].practitioner).toBeUndefined();
    expect(result['task-waiting'].task.id).toBe('task-waiting');
  });

  it('excludes a waiting-room Task whose authoredOn is older than the window', async () => {
    mockSearch([waitingRoomTask({ authoredOn: oldDate })]);

    const result = await getRecentlyAssignedTasksMap(mockOystehr as any, fromDate);
    expect(result['task-waiting']).toBeUndefined();
  });

  it('excludes a non-waiting-room Task that has no owner (existing behavior preserved)', async () => {
    mockSearch([erxTask()]);

    const result = await getRecentlyAssignedTasksMap(mockOystehr as any, fromDate);
    expect(result['task-erx']).toBeUndefined();
  });

  it('includes a non-waiting-room Task with an owner assigned within the window, attaching the practitioner', async () => {
    const practitioner = makePractitioner('practitioner-1');
    const task = erxTask({
      owner: {
        reference: 'Practitioner/practitioner-1',
        extension: [
          {
            url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
            valueDateTime: recentDate,
          },
        ],
      },
    });
    mockSearch([task, practitioner]);

    const result = await getRecentlyAssignedTasksMap(mockOystehr as any, fromDate);
    expect(result['task-erx']).toBeDefined();
    expect(result['task-erx'].practitioner?.id).toBe('practitioner-1');
  });

  it('excludes a non-waiting-room Task whose owner was assigned before the window', async () => {
    const practitioner = makePractitioner('practitioner-1');
    const task = erxTask({
      owner: {
        reference: 'Practitioner/practitioner-1',
        extension: [
          {
            url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
            valueDateTime: oldDate,
          },
        ],
      },
    });
    mockSearch([task, practitioner]);

    const result = await getRecentlyAssignedTasksMap(mockOystehr as any, fromDate);
    expect(result['task-erx']).toBeUndefined();
  });
});
