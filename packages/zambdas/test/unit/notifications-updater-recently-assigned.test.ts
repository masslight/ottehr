import { Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  OttehrTaskSystem,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { buildRecentlyAssignedTasksMap, resolveTaskRecipients } from '../../src/cron/notifications-updater';

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

describe('buildRecentlyAssignedTasksMap', () => {
  it('includes a waiting-room Task with no owner when authoredOn is within the window', () => {
    const result = buildRecentlyAssignedTasksMap([waitingRoomTask()], fromDate);
    expect(result['task-waiting']).toBeDefined();
    expect(result['task-waiting'].practitioner).toBeUndefined();
    expect(result['task-waiting'].task.id).toBe('task-waiting');
  });

  it('excludes a waiting-room Task whose authoredOn is older than the window', () => {
    const result = buildRecentlyAssignedTasksMap([waitingRoomTask({ authoredOn: oldDate })], fromDate);
    expect(result['task-waiting']).toBeUndefined();
  });

  it('excludes a non-waiting-room Task that has no owner (existing behavior preserved)', () => {
    const result = buildRecentlyAssignedTasksMap([erxTask()], fromDate);
    expect(result['task-erx']).toBeUndefined();
  });

  it('includes a non-waiting-room Task with an owner assigned within the window, attaching the practitioner', () => {
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

    const result = buildRecentlyAssignedTasksMap([task, practitioner], fromDate);
    expect(result['task-erx']).toBeDefined();
    expect(result['task-erx'].practitioner?.id).toBe('practitioner-1');
  });

  it('excludes a non-waiting-room Task whose owner was assigned before the window', () => {
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

    const result = buildRecentlyAssignedTasksMap([task, practitioner], fromDate);
    expect(result['task-erx']).toBeUndefined();
  });
});

describe('resolveTaskRecipients', () => {
  const providers = [makePractitioner('provider-1'), makePractitioner('provider-2')];

  it('notifies all active providers for an unassigned waiting-room Task', () => {
    expect(resolveTaskRecipients(waitingRoomTask(), undefined, providers)).toEqual(providers);
  });

  it('notifies only the owner when the Task is assigned', () => {
    const owner = makePractitioner('owner-1');
    expect(resolveTaskRecipients(waitingRoomTask(), owner, providers)).toEqual([owner]);
  });

  it('notifies no one for an unassigned non-waiting-room Task', () => {
    expect(resolveTaskRecipients(erxTask(), undefined, providers)).toEqual([]);
  });
});
