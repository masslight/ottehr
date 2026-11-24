import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, FhirResource, Patient, Reference, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_CATEGORY_IDENTIFIER } from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getReferralSpecialty, getReferralUrgency } from 'utils/lib/fhir/referral';
import { getPatchBinary, getPatchOperationToRemoveMetaTags } from 'utils/lib/fhir/resourcePatch';
import { addOrReplaceOperation } from 'utils/lib/helpers/operations';
import {
  REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
  REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
} from 'utils/lib/types/api/provider-notifications';
import {
  REFERRAL_DEFAULTS,
  REFERRAL_OVERDUE_DAYS,
  REFERRAL_TASK,
  referralReviewTaskTitle,
  referralTaskTitle,
  ReferralUrgency,
} from 'utils/lib/types/api/referrals/referrals.types';
import { getTaskInputValue } from 'utils/lib/types/data/tasks/types';
import { compareDates } from 'utils/lib/utils/dateUtils';
import { createOwnerReference, createTask } from '../tasks';

export const OPEN_TASK_STATUSES: Task['status'][] = [
  'draft',
  'requested',
  'received',
  'accepted',
  'ready',
  'in-progress',
  'on-hold',
];
export const isOpenTask = (task: Task): boolean => OPEN_TASK_STATUSES.includes(task.status);

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

const newestTaskFirst = (a: Task, b: Task): number => compareDates(a.authoredOn, b.authoredOn);

export const newestTask = (tasks: Task[]): Task | undefined => [...tasks].sort(newestTaskFirst)[0];

export const findOpenReferralTasks = async (oystehr: Oystehr, referralId: string): Promise<Task[]> =>
  (await findReferralTasks(oystehr, referralId)).filter(isOpenTask);

export const findOpenReferralTask = async (oystehr: Oystehr, referralId: string): Promise<Task | undefined> =>
  newestTask(await findOpenReferralTasks(oystehr, referralId));

export const referralOverdueAt = (urgency: ReferralUrgency, anchorIso: string): string =>
  DateTime.fromISO(anchorIso, { zone: 'utc' }).plus({ days: REFERRAL_OVERDUE_DAYS[urgency] }).toISO() ?? '';

const taskUrgency = (task: Task): ReferralUrgency =>
  (getTaskInputValue(task, REFERRAL_TASK.input.urgency) as ReferralUrgency | undefined) ?? REFERRAL_DEFAULTS.urgency;

const OVERDUE_NOTIFIED_TAG: Coding = {
  system: REFERRAL_OVERDUE_NOTIFIED_TAG_SYSTEM,
  code: REFERRAL_OVERDUE_NOTIFIED_TAG_CODE,
};

const isOverdueNotifiedTag = (tag: Coding): boolean =>
  tag.system === OVERDUE_NOTIFIED_TAG.system && tag.code === OVERDUE_NOTIFIED_TAG.code;

export const hasOverdueNotifiedTag = (task: Task): boolean => !!task.meta?.tag?.some(isOverdueNotifiedTag);

export const withoutOverdueNotifiedTag = (task: Task): Task =>
  hasOverdueNotifiedTag(task)
    ? { ...task, meta: { ...task.meta, tag: task.meta?.tag?.filter((tag) => !isOverdueNotifiedTag(tag)) } }
    : task;

const overdueOperations = (task: Task, anchorIso: string): Operation[] => [
  addOrReplaceOperation(task.restriction, '/restriction', {
    period: { end: referralOverdueAt(taskUrgency(task), anchorIso) },
  }),
  ...(hasOverdueNotifiedTag(task) ? [getPatchOperationToRemoveMetaTags(task, [OVERDUE_NOTIFIED_TAG])] : []),
];

/** Restarts one open task's overdue clock from `anchorIso`, as a request for the caller's transaction. */
export const referralTaskOverdueRequest = (task: Task, anchorIso: string): BatchInputPatchRequest<FhirResource> =>
  getPatchBinary({ resourceType: 'Task', resourceId: task.id!, patchOperations: overdueOperations(task, anchorIso) });

export type SettledReferralTaskStatus = Extract<Task['status'], 'completed' | 'cancelled'>;

const settleOperations = (status: SettledReferralTaskStatus): Operation[] => [
  { op: 'replace', path: '/status', value: status },
];

/** Completes or cancels one open task, as a request for the caller's transaction. */
export const referralTaskSettleRequest = (
  task: Task,
  status: SettledReferralTaskStatus
): BatchInputPatchRequest<FhirResource> =>
  getPatchBinary({ resourceType: 'Task', resourceId: task.id!, patchOperations: settleOperations(status) });

/**
 * A referral's task: awaiting the response, or, given the filed response document, reviewing it.
 * Owned (and so in progress) when `owner` names a Practitioner. `referralReference` is the referral's fullUrl
 * when the task is created in the same transaction as the referral.
 */
export const buildReferralTask = (args: {
  serviceRequest: ServiceRequest;
  referralReference?: string;
  patient: Patient;
  recipientName?: string;
  owner?: Reference;
  location?: { id: string; name?: string };
  responseDocument?: Reference;
}): Task => {
  const { serviceRequest, patient, recipientName, owner, location, responseDocument } = args;
  const referralReference = args.referralReference ?? `ServiceRequest/${serviceRequest.id}`;
  const specialty = getReferralSpecialty(serviceRequest);
  const task = createTask({
    category: REFERRAL_TASK.category,
    title: responseDocument
      ? referralReviewTaskTitle(specialty, recipientName)
      : referralTaskTitle(specialty, recipientName),
    code: {
      system: REFERRAL_TASK.system,
      code: responseDocument ? REFERRAL_TASK.code.reviewResponse : REFERRAL_TASK.code.awaitResponse,
    },
    encounterId: getIdFromReference(serviceRequest.encounter?.reference, 'Encounter'),
    location,
    input: [
      { type: REFERRAL_TASK.input.referralId, valueReference: { reference: referralReference } },
      {
        type: REFERRAL_TASK.input.patient,
        valueReference: { reference: `Patient/${patient.id}`, display: getFullestAvailableName(patient) },
      },
      { type: REFERRAL_TASK.input.specialty, valueString: specialty },
      { type: REFERRAL_TASK.input.recipientName, valueString: recipientName },
      responseDocument
        ? { type: REFERRAL_TASK.input.responseDocumentReferenceId, valueReference: responseDocument }
        : { type: REFERRAL_TASK.input.urgency, valueString: getReferralUrgency(serviceRequest) },
    ],
    basedOn: [referralReference, ...(responseDocument?.reference ? [responseDocument.reference] : [])],
  });
  const ownerId = getIdFromReference(owner?.reference, 'Practitioner');
  return ownerId
    ? { ...task, owner: createOwnerReference(ownerId, owner?.display ?? ''), status: 'in-progress' }
    : task;
};
