import { Encounter, Task as FhirTask } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { REFERRAL_TASK } from 'utils/lib/types/api/referrals/referrals.types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: vi.fn(),
  safelyCaptureException: vi.fn(),
}));

import { TASK_CATEGORY_LABEL } from '../../src/features/tasks/common';
import { fhirTaskToTask, isTaskOverdue } from '../../src/features/visits/in-person/hooks/useTasks';

const input = (
  code: string,
  value: { valueString?: string; valueReference?: { reference: string } }
): FhirTask['input'] => [{ type: { coding: [{ system: TASK_INPUT_SYSTEM, code }] }, ...value }];

const makeReferralTask = (overrides: Partial<FhirTask> = {}): FhirTask => ({
  resourceType: 'Task',
  id: 'task-1',
  status: 'in-progress',
  intent: 'order',
  authoredOn: '2026-10-23T15:00:00.000Z',
  description: 'Referral: Orthopedics, Riverside Orthopedic Associates',
  groupIdentifier: { value: REFERRAL_TASK.category },
  code: { coding: [{ system: REFERRAL_TASK.system, code: REFERRAL_TASK.code.awaitResponse }] },
  encounter: { reference: 'Encounter/enc-1' },
  restriction: { period: { end: DateTime.now().minus({ days: 2 }).toISO()! } },
  input: [
    ...input(REFERRAL_TASK.input.urgency, { valueString: 'urgent' })!,
    ...input(REFERRAL_TASK.input.patient, { valueReference: { reference: 'Patient/pat-1' } })!,
  ],
  ...overrides,
});

const encounters = new Map<string, Encounter>([
  [
    'enc-1',
    {
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'finished',
      class: { code: 'AMB' },
      appointment: [{ reference: 'Appointment/appt-1' }],
    },
  ],
]);

describe('referral task rows', () => {
  it('has a Referrals category label', () => {
    expect(TASK_CATEGORY_LABEL[REFERRAL_TASK.category]).toBe('Referrals');
  });

  it('shows the overdue subtitle and links to the visit', () => {
    const row = fhirTaskToTask(makeReferralTask(), encounters);
    expect(row.title).toBe('Referral: Orthopedics, Riverside Orthopedic Associates');
    expect(row.subtitle).toBe('Urgent: no response after 7 days');
    expect(row.overdue).toBe(true);
    // Closing the referral completes the task; the Tasks page only links to where Close lives.
    expect(row.completable).toBe(false);
    expect(row.action).toEqual({ name: 'Go to task', link: '/in-person/appt-1' });
  });

  it('shows the urgency alone while waiting, and "Response received" once a response is filed', () => {
    const waiting = fhirTaskToTask(
      makeReferralTask({ restriction: { period: { end: DateTime.now().plus({ days: 5 }).toISO()! } } })
    );
    expect(waiting.subtitle).toBe('Urgent');
    expect(waiting.overdue).toBe(false);

    const answered = fhirTaskToTask(
      makeReferralTask({
        input: [
          ...input(REFERRAL_TASK.input.urgency, { valueString: 'urgent' })!,
          ...input(REFERRAL_TASK.input.responseDocumentReferenceId, {
            valueReference: { reference: 'DocumentReference/doc-1' },
          })!,
        ],
      })
    );
    expect(answered.subtitle).toBe('Urgent: Response received');

    const answeredByString = fhirTaskToTask(
      makeReferralTask({
        input: [
          ...input(REFERRAL_TASK.input.urgency, { valueString: 'urgent' })!,
          ...input(REFERRAL_TASK.input.responseDocumentReferenceId, { valueString: 'doc-1' })!,
        ],
      })
    );
    expect(answeredByString.subtitle).toBe('Urgent: Response received');
  });

  it('links to the patient record when the referral has no visit', () => {
    const row = fhirTaskToTask(makeReferralTask({ encounter: undefined }));
    expect(row.action).toEqual({ name: 'Go to task', link: '/patient/pat-1' });
  });

  it('is never overdue once completed or cancelled, or without a period end', () => {
    expect(isTaskOverdue(makeReferralTask({ status: 'completed' }))).toBe(false);
    expect(isTaskOverdue(makeReferralTask({ status: 'cancelled' }))).toBe(false);
    expect(isTaskOverdue(makeReferralTask({ restriction: undefined }))).toBe(false);
    expect(isTaskOverdue(makeReferralTask())).toBe(true);
  });
});
