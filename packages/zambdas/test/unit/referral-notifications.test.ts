import { Communication, Encounter, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import {
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import {
  getUiTaskCategoryForCode,
  normalizeNotificationPreferencesV2,
  REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
  REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
  taskCategoryHasNoLocation,
} from 'utils/lib/types/api/provider-notifications';
import { REFERRAL_TASK } from 'utils/lib/types/api/referrals/referrals.types';
import { describe, expect, it } from 'vitest';
import {
  buildReferralOverdueMessage,
  buildTaskNotificationAbout,
  findOverdueReferralTasks,
} from '../../src/cron/notifications-updater';
import { resolveNotificationTarget } from '../../src/ehr/notifications/shared/notifications';
import { hasOverdueNotifiedTag } from '../../src/shared/referrals/referral-task';

const NOW = DateTime.fromISO('2026-11-02T12:00:00.000Z');

const referralTask = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  description: 'Referral: Orthopedics, Riverside Orthopedic Associates',
  groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
  basedOn: [{ reference: 'ServiceRequest/sr-1' }],
  owner: { reference: 'Practitioner/prac-1', display: 'J. Rivera, MD' },
  restriction: { period: { end: '2026-11-01T12:00:00.000Z' } },
  input: [
    {
      type: { coding: [{ system: TASK_INPUT_SYSTEM, code: REFERRAL_TASK.input.patient }] },
      valueReference: { reference: 'Patient/pat-1', display: 'Example, Maya' },
    },
  ],
  ...overrides,
});

const owner: Practitioner = { resourceType: 'Practitioner', id: 'prac-1' };

describe('referrals notification category', () => {
  it('maps the referral task category to a Referrals row that is pinned to all locations', () => {
    expect(getUiTaskCategoryForCode(REFERRAL_TASK.category)).toBe('referrals');
    expect(taskCategoryHasNoLocation('referrals')).toBe(true);
    const prefs = normalizeNotificationPreferencesV2({ version: 2 } as never);
    expect(prefs.taskCategories.referrals).toMatchObject({ allLocations: true, locationIds: [] });
  });
});

describe('findOverdueReferralTasks', () => {
  it('returns open referral tasks past their period end with their owner', () => {
    const result = findOverdueReferralTasks([referralTask(), owner], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].task.id).toBe('task-1');
    expect(result[0].owner).toBe(owner);
  });

  it('leaves out an overdue task nobody owns, so it is neither tagged notified nor lost', () => {
    const unowned = referralTask({ id: 'unowned', owner: undefined });
    const ownerGone = referralTask({ id: 'owner-gone', owner: { reference: 'Practitioner/prac-missing' } });
    expect(findOverdueReferralTasks([unowned, ownerGone, referralTask(), owner], NOW).map((r) => r.task.id)).toEqual([
      'task-1',
    ]);
  });

  it('skips tasks not yet due, already notified, or outside the referral category', () => {
    const notDue = referralTask({ id: 'not-due', restriction: { period: { end: '2026-11-03T12:00:00.000Z' } } });
    const notified = referralTask({
      id: 'notified',
      meta: { tag: [{ system: REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM, code: REFERRAL_OVERDUE_NOTIFIED_TAG_CODE }] },
    });
    const other = referralTask({ id: 'other', groupIdentifier: { value: 'manual-other' } });
    const noEnd = referralTask({ id: 'no-end', restriction: undefined });
    expect(findOverdueReferralTasks([notDue, notified, other, noEnd, owner], NOW)).toEqual([]);
    expect(hasOverdueNotifiedTag(notified)).toBe(true);
  });

  it('builds the overdue message from the task description', () => {
    expect(buildReferralOverdueMessage(referralTask())).toBe(
      'Referral overdue: Referral: Orthopedics, Riverside Orthopedic Associates'
    );
  });
});

describe('referral notification target', () => {
  const referralNotification = (overrides: Partial<Communication> = {}): Communication => ({
    resourceType: 'Communication',
    status: 'in-progress',
    category: [
      {
        coding: [
          { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'task-category-created' },
          { system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM, code: 'referrals' },
        ],
      },
    ],
    basedOn: [{ reference: 'Task/task-1' }],
    ...overrides,
  });

  it('stamps the patient on `about` for a referral task', () => {
    expect(buildTaskNotificationAbout(referralTask())).toEqual([{ reference: 'Patient/pat-1' }]);
    expect(buildTaskNotificationAbout(referralTask({ input: undefined }))).toBeUndefined();
  });

  const visitEncounter: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/appt-1' }],
  };

  it('targets the patient’s referrals when the task has no visit', () => {
    expect(
      resolveNotificationTarget(referralNotification({ about: [{ reference: 'Patient/pat-1' }] }), new Map())
    ).toEqual({ type: 'referral', patientId: 'pat-1' });
    expect(resolveNotificationTarget(referralNotification(), new Map())).toBeUndefined();
  });

  it('targets the referral on its visit, not the visit details page, when the overdue notification carries the encounter', () => {
    expect(
      resolveNotificationTarget(
        referralNotification({ encounter: { reference: 'Encounter/enc-1' }, about: [{ reference: 'Patient/pat-1' }] }),
        new Map([['enc-1', visitEncounter]])
      )
    ).toEqual({ type: 'referral', patientId: 'pat-1', appointmentId: 'appt-1' });
  });

  it('falls back to the patient’s referrals when the encounter was not included in the search', () => {
    expect(
      resolveNotificationTarget(
        referralNotification({ encounter: { reference: 'Encounter/enc-1' }, about: [{ reference: 'Patient/pat-1' }] }),
        new Map()
      )
    ).toEqual({ type: 'referral', patientId: 'pat-1' });
  });

  it('targets the patient’s referrals from an assignment notification for a routed review task, which carries no encounter', () => {
    const assigned = referralNotification({
      category: [
        {
          coding: [
            { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'task-assigned' },
            { system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM, code: 'referrals' },
          ],
        },
      ],
      about: [{ reference: 'Patient/pat-1' }],
    });
    expect(resolveNotificationTarget(assigned, new Map([['enc-1', visitEncounter]]))).toEqual({
      type: 'referral',
      patientId: 'pat-1',
    });
    expect(
      resolveNotificationTarget(
        { ...assigned, encounter: { reference: 'Encounter/enc-1' } },
        new Map([['enc-1', visitEncounter]])
      )
    ).toEqual({ type: 'referral', patientId: 'pat-1', appointmentId: 'appt-1' });
  });
});
