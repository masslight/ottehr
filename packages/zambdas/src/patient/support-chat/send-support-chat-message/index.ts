import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Communication, Reference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAccountForUser, UserAccount } from 'utils/lib/auth/user-auth.helper';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getPatchBinary, getPatchOperationForNewMetaTag } from 'utils/lib/fhir/resourcePatch';
import { SendSupportChatMessageInputSchema, SUPPORT_CHAT_UNREAD_TAG } from 'utils/lib/types/api/support-chat.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { resolveStep } from '../../../shared/support-chat/bot';
import {
  buildRequestTask,
  canAutoAssign,
  findLatestVisitLocation,
  findOpenTasks,
  getAttachOperations,
  getDefaultPatientId,
  getTaskPatientId,
  getVisitProviderOwner,
  getVisits,
  hasUnreadTag,
  moveRequestTask,
} from '../../../shared/support-chat/request-task';
import {
  buildThreadMessage,
  getLastThreadMessage,
  isAccountReadyForChat,
  isStaffUser,
  searchThread,
  toChatResponse,
} from '../../../shared/support-chat/thread';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

let m2mToken: string;

export const index = wrapHandler(
  'send-support-chat-message',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const userToken = getUserToken(input);

    const { secrets, ...action } = validateWithSchema(SendSupportChatMessageInputSchema, input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const user = await getUser(userToken, secrets);

    if (isStaffUser(user)) throw NOT_AUTHORIZED;

    const account = await getAccountForUser(user, oystehr);

    const threadId = account.person?.id;

    if (!threadId || !isAccountReadyForChat(account)) throw NOT_AUTHORIZED;

    const [thread, visits, openTasks] = await Promise.all([
      searchThread(oystehr, threadId),
      getVisits(oystehr, account.patients),
      findOpenTasks(oystehr, threadId),
    ]);

    const openTask = openTasks.at(0);

    const last = getLastThreadMessage(thread);

    const step = resolveStep({
      last,
      action,
      patients: account.patients.map((patient) => ({
        id: patient.id!,
        label: getFullestAvailableName(patient) ?? '',
      })),
      visits: visits.map((visit) => ({
        id: visit.appointmentId,
        patientId: visit.patient.id!,
        label: visit.label,
        date: visit.date,
      })),
      defaultPatientId: getDefaultPatientId(thread, visits),
      hasOpenTask: !!openTask,
    });

    const requests: BatchInputRequest<Task | Communication>[] = [];
    const intent = step.task;
    let taskReference: string | undefined;
    let patientId = step.patientId;

    if (intent?.type === 'create') {
      const patient = account.patients.find((p) => p.id === intent.patientId);
      const visit = intent.appointmentId ? visits.find((v) => v.appointmentId === intent.appointmentId) : undefined;

      if (!patient || (intent.appointmentId && !visit)) throw INVALID_INPUT_ERROR('The request cannot be created');

      const owner = await getVisitProviderOwner(oystehr, visit);
      taskReference = `urn:uuid:${randomUUID()}`;

      requests.push({
        method: 'POST',
        url: '/Task',
        fullUrl: taskReference,
        resource: buildRequestTask({
          code: intent.code,
          threadId,
          patient,
          visit,
          location: findLatestVisitLocation(visits, patient.id),
          owner,
          text: intent.text,
          details: intent.details,
        }),
      });
    } else if (intent?.type === 'update') {
      const patient = account.patients.find((p) => p.id === intent.patientId);
      const visit = intent.appointmentId ? visits.find((v) => v.appointmentId === intent.appointmentId) : undefined;
      const taskId = last?.taskId;

      if (!patient || !taskId || (intent.appointmentId && !visit)) {
        throw INVALID_INPUT_ERROR('The visit is not available for selection');
      }

      const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
      const reassign = canAutoAssign(task, visits);
      const owner = reassign ? await getVisitProviderOwner(oystehr, visit) : undefined;
      const next = buildRequestTask({
        code: PATIENT_REQUEST_TASK.code.followUp,
        threadId,
        patient,
        visit,
        location: findLatestVisitLocation(visits, patient.id),
        owner,
        text: intent.text,
      });

      taskReference = `Task/${taskId}`;
      patientId = patient.id;

      requests.push({
        method: 'PUT',
        url: taskReference,
        ifMatch: makeOptimisticLockIfMatchHeader(task),
        resource: moveRequestTask(task, next, reassign),
      });
    } else if (intent?.type === 'attach') {
      const target = intent.taskId ? openTasks.find((task) => task.id === intent.taskId) : openTask;

      if (target) {
        taskReference = `Task/${target.id}`;
        patientId = getTaskPatientId(target);

        requests.push(
          getPatchBinary({
            resourceType: 'Task',
            resourceId: target.id!,
            patchOperations: getAttachOperations(target, intent.text),
            ifMatch: makeOptimisticLockIfMatchHeader(target),
          })
        );
      }
    }

    if (action.action === 'text') {
      openTasks
        .filter((task) => `Task/${task.id}` !== taskReference && !hasUnreadTag(task))
        .forEach((task) =>
          requests.push(
            getPatchBinary({
              resourceType: 'Task',
              resourceId: task.id!,
              patchOperations: [getPatchOperationForNewMetaTag(task, SUPPORT_CHAT_UNREAD_TAG)],
              ifMatch: makeOptimisticLockIfMatchHeader(task),
            })
          )
        );
    }

    const sender = getPatientSender(account, patientId);
    const now = DateTime.now();

    step.messages.forEach((message, index) => {
      requests.push({
        method: 'POST',
        url: '/Communication',
        resource: buildThreadMessage({
          ...message,
          threadId,
          sent: now.plus({ milliseconds: index }).toISO()!,
          sender: message.author === 'patient' ? sender : undefined,
          patientId,
          taskReference,
        }),
      });
    });

    const created = (await oystehr.fhir.transaction<Task | Communication>({ requests }))
      .unbundle()
      .filter((resource): resource is Communication => resource.resourceType === 'Communication');

    const messages = [...thread, ...created];

    return { statusCode: 200, body: JSON.stringify(toChatResponse(messages, 'patient')) };
  }
);

function getPatientSender(account: UserAccount, patientId: string | undefined): Reference {
  const relatedPerson =
    account.relatedPersons.find((rp) => rp.patient.reference === `Patient/${patientId}`) ?? account.relatedPersons[0];

  const patient = account.patients.find((p) => `Patient/${p.id}` === relatedPerson.patient.reference);

  return {
    reference: `RelatedPerson/${relatedPerson.id}`,
    display: patient && getFullestAvailableName(patient),
  };
}
