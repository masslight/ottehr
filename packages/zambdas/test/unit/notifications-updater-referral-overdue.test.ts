import Oystehr from '@oystehr/sdk';
import { Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER, TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import {
  REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
  REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
} from 'utils/lib/types/api/provider-notifications';
import { REFERRAL_TASK } from 'utils/lib/types/api/referrals/referrals.types';
import { describe, expect, it, vi } from 'vitest';
import {
  buildTaskNotificationRequest,
  findOverdueReferralTasks,
  getOpenReferralTaskResources,
} from '../../src/cron/notifications-updater';
import { OPEN_TASK_STATUSES } from '../../src/shared/referrals/referral-task';

const NOW = DateTime.fromISO('2026-11-02T12:00:00.000Z');

const referralTask = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  description: 'Referral: Orthopedics',
  groupIdentifier: { system: TASK_CATEGORY_IDENTIFIER, value: REFERRAL_TASK.category },
  encounter: { reference: 'Encounter/enc-1' },
  owner: { reference: 'Practitioner/prac-1' },
  restriction: { period: { end: '2026-11-01T12:00:00.000Z' } },
  input: [
    {
      type: { coding: [{ system: TASK_INPUT_SYSTEM, code: REFERRAL_TASK.input.patient }] },
      valueReference: { reference: 'Patient/pat-1' },
    },
  ],
  ...overrides,
});

const owner: Practitioner = { resourceType: 'Practitioner', id: 'prac-1' };

describe('getOpenReferralTaskResources', () => {
  it('searches referral tasks in every open status, skipping those already notified as overdue, with their owners', async () => {
    const search = vi.fn(async () => ({ total: 0, entry: [], unbundle: () => [] }));

    await getOpenReferralTaskResources({ fhir: { search } } as unknown as Oystehr);

    expect(search).toHaveBeenCalledTimes(1);
    const [{ resourceType, params }] = search.mock.calls[0] as unknown as [
      { resourceType: string; params: { name: string; value: string }[] },
    ];
    expect(resourceType).toBe('Task');
    expect(params).toEqual(
      expect.arrayContaining([
        { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${REFERRAL_TASK.category}` },
        { name: 'status', value: 'draft,requested,received,accepted,ready,in-progress,on-hold' },
        { name: '_tag:not', value: `${REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM}|${REFERRAL_OVERDUE_NOTIFIED_TAG_CODE}` },
        { name: '_include', value: 'Task:owner' },
      ])
    );
    expect(params.find((param) => param.name === 'status')?.value).toBe(OPEN_TASK_STATUSES.join(','));
  });
});

describe('findOverdueReferralTasks owner lookup', () => {
  it('resolves the owner from a versioned Practitioner reference', () => {
    const versioned = referralTask({ owner: { reference: 'Practitioner/prac-1/_history/2' } });
    expect(findOverdueReferralTasks([versioned, owner], NOW).map((r) => r.owner)).toEqual([owner]);
  });

  it('ignores an owner reference to another resource type that shares the id', () => {
    const relatedPersonOwner = referralTask({ owner: { reference: 'RelatedPerson/prac-1' } });
    expect(findOverdueReferralTasks([relatedPersonOwner, owner], NOW)).toEqual([]);
  });
});

describe('buildTaskNotificationRequest', () => {
  const recipient: Practitioner = { resourceType: 'Practitioner', id: 'prac-9' };
  const sent = expect.any(String);

  it('builds the category-created notification with the type and category codings and the referral visit', () => {
    expect(
      buildTaskNotificationRequest({
        task: referralTask(),
        type: AppointmentProviderNotificationTypes.task_category_created,
        uiCategory: 'referrals',
        recipient,
        status: 'in-progress',
        message: 'New Referrals task: Referral: Orthopedics',
      })
    ).toEqual({
      method: 'POST',
      url: '/Communication',
      resource: {
        resourceType: 'Communication',
        category: [
          {
            coding: [
              { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'task-category-created' },
              { system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM, code: 'referrals', display: 'Referrals' },
            ],
          },
        ],
        sent,
        status: 'in-progress',
        basedOn: [{ reference: 'Task/task-1' }],
        encounter: { reference: 'Encounter/enc-1' },
        about: [{ reference: 'Patient/pat-1' }],
        recipient: [{ reference: 'Practitioner/prac-9' }],
        payload: [{ contentString: 'New Referrals task: Referral: Orthopedics' }],
      },
    });
  });

  it('leaves out the category coding and the encounter for an uncategorized task', () => {
    const task: Task = {
      resourceType: 'Task',
      id: 'task-2',
      status: 'ready',
      intent: 'order',
      encounter: { reference: 'Encounter/enc-2' },
    };
    const request = buildTaskNotificationRequest({
      task,
      type: AppointmentProviderNotificationTypes.task_assigned,
      uiCategory: undefined,
      recipient,
      status: 'completed',
      message: 'A new task has been assigned to you: task ID task-2',
    });
    expect(request.resource.category).toEqual([
      { coding: [{ system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: 'task-assigned' }] },
    ]);
    expect(request.resource).not.toHaveProperty('encounter');
    expect(request.resource.about).toBeUndefined();
    expect(request.resource.status).toBe('completed');
  });

  it('places the encounter after basedOn for the overdue referral notification, so the bell opens the visit', () => {
    const request = buildTaskNotificationRequest({
      task: referralTask(),
      type: AppointmentProviderNotificationTypes.task_category_created,
      uiCategory: 'referrals',
      recipient: owner,
      status: 'in-progress',
      message: 'Referral overdue: Referral: Orthopedics',
    });
    expect(Object.keys(request.resource)).toEqual([
      'resourceType',
      'category',
      'sent',
      'status',
      'basedOn',
      'encounter',
      'about',
      'recipient',
      'payload',
    ]);
    expect(request.resource.encounter).toEqual({ reference: 'Encounter/enc-1' });
  });

  it.each([
    AppointmentProviderNotificationTypes.task_assigned,
    AppointmentProviderNotificationTypes.task_category_created,
    AppointmentProviderNotificationTypes.task_note_added,
  ])('carries the referral task visit on a %s notification so the bell opens its Plan tab', (type) => {
    const request = buildTaskNotificationRequest({
      task: referralTask(),
      type,
      uiCategory: 'referrals',
      recipient,
      status: 'in-progress',
      message: 'm',
    });
    expect(request.resource.encounter).toEqual({ reference: 'Encounter/enc-1' });
  });

  it('leaves the encounter off a referral task made without a visit, so the bell opens the patient Referrals tab', () => {
    const request = buildTaskNotificationRequest({
      task: referralTask({ encounter: undefined }),
      type: AppointmentProviderNotificationTypes.task_assigned,
      uiCategory: 'referrals',
      recipient,
      status: 'in-progress',
      message: 'm',
    });
    expect(request.resource).not.toHaveProperty('encounter');
  });

  it('leaves the encounter off every non-referral category, even when the task has one', () => {
    const request = buildTaskNotificationRequest({
      task: referralTask({ groupIdentifier: { value: 'manual-charting' } }),
      type: AppointmentProviderNotificationTypes.task_category_created,
      uiCategory: 'charting',
      recipient,
      status: 'in-progress',
      message: 'm',
    });
    expect(request.resource).not.toHaveProperty('encounter');
  });
});
