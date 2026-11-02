import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import {
  REFERRAL_DEFAULTS,
  REFERRAL_OVERDUE_DAYS,
  REFERRAL_TASK,
  ReferralUrgency,
} from 'utils/lib/types/api/referrals/referrals.types';
import { getTaskInputValue } from 'utils/lib/types/data/tasks/types';

/** Task statuses that still count as "open" for the referral worklist. */
const CLOSED_TASK_STATUSES: Task['status'][] = ['completed', 'cancelled', 'failed', 'rejected', 'entered-in-error'];
export const isOpenTask = (task: Task): boolean => !CLOSED_TASK_STATUSES.includes(task.status);

/** Every referral-category task of a referral, open or not. */
export const findReferralTasks = async (oystehr: Oystehr, referralId: string): Promise<Task[]> =>
  (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'based-on', value: `ServiceRequest/${referralId}` },
        { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${REFERRAL_TASK.category}` },
      ],
    })
  ).unbundle();

/** When a response becomes overdue: the urgency's window counted from when the referral went out (in UTC, so the result does not depend on the machine's zone). */
export const referralOverdueAt = (urgency: ReferralUrgency, anchorIso: string): string =>
  DateTime.fromISO(anchorIso, { zone: 'utc' }).plus({ days: REFERRAL_OVERDUE_DAYS[urgency] }).toISO() ?? '';

const taskUrgency = (task: Task): ReferralUrgency =>
  (getTaskInputValue(task, REFERRAL_TASK.input.urgency) as ReferralUrgency | undefined) ?? REFERRAL_DEFAULTS.urgency;

/**
 * Starts the overdue clock on a referral's open "awaiting response" task from `anchorIso` (when it was faxed or
 * handed to the patient). A referral without an open task has nothing to time.
 */
export const setReferralTaskOverdue = async (
  oystehr: Oystehr,
  referralId: string,
  anchorIso: string
): Promise<void> => {
  const openTasks = (await findReferralTasks(oystehr, referralId)).filter(isOpenTask);
  await Promise.all(
    openTasks.map((task) =>
      oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          {
            op: task.restriction ? 'replace' : 'add',
            path: '/restriction',
            value: { period: { end: referralOverdueAt(taskUrgency(task), anchorIso) } },
          },
        ],
      })
    )
  );
};
