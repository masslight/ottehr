import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Communication, Reference, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAccountForUser, UserAccount } from 'utils/lib/auth/user-auth.helper';
import { TASK_LOCATION_SYSTEM } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { SendSupportChatMessageInputSchema } from 'utils/lib/types/api/support-chat.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { resolveStep } from '../../../shared/support-chat/bot';
import {
  buildRequestTask,
  findOpenTask,
  getAttachOperations,
  getTaskPatientId,
  getVisits,
} from '../../../shared/support-chat/request-task';
import {
  buildThreadMessage,
  isAccountReadyForChat,
  isStaffUser,
  searchThread,
  toChatResponse,
  toThreadMessage,
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

    const [thread, visits, openTask] = await Promise.all([
      searchThread(oystehr, threadId),
      getVisits(oystehr, account.patients),
      findOpenTask(oystehr, threadId),
    ]);

    const lastMessage = thread.at(-1);

    const step = resolveStep({
      last: lastMessage ? toThreadMessage(lastMessage) : undefined,
      requestText: thread.at(-2)?.payload?.[0]?.contentString,
      action,
      visits: visits.map((visit) => ({ id: visit.appointmentId, label: visit.label })),
      hasOpenTask: !!openTask,
    });

    const requests: BatchInputRequest<Task | Communication>[] = [];
    let taskReference: string | undefined;
    let patientId: string | undefined;

    if (step.task?.type === 'create') {
      const { code, appointmentId, text, details } = step.task;
      const lastPatientId = thread.findLast((message) => message.subject)?.subject?.reference?.replace('Patient/', '');
      const lastPatient = account.patients.find((p) => p.id === lastPatientId);
      const defaultVisit = lastPatient ? visits.find((v) => v.patient.id === lastPatient.id) : visits[0];
      const visit = appointmentId ? visits.find((v) => v.appointmentId === appointmentId) : defaultVisit;
      const patient = visit?.patient ?? lastPatient ?? account.patients[0];
      taskReference = `urn:uuid:${randomUUID()}`;
      patientId = patient.id;

      requests.push({
        method: 'POST',
        url: '/Task',
        fullUrl: taskReference,
        resource: buildRequestTask({ code, threadId, patient, visit, text, details }),
      });
    } else if (step.task?.type === 'set-visit') {
      const { appointmentId, text } = step.task;
      const visit = visits.find((v) => v.appointmentId === appointmentId);
      const taskId = lastMessage?.about?.[0]?.reference?.replace('Task/', '');

      if (!visit || !taskId) throw INVALID_INPUT_ERROR('The visit is not available for selection');

      const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

      const next = buildRequestTask({
        code: PATIENT_REQUEST_TASK.code.followUp,
        threadId,
        patient: visit.patient,
        visit,
        text,
      });

      taskReference = `Task/${taskId}`;
      patientId = visit.patient.id;

      const keptTags = (task.meta?.tag ?? []).filter((tag) => tag.system !== TASK_LOCATION_SYSTEM);

      const addedTags = (next.meta?.tag ?? []).filter(
        (tag) => !keptTags.some((kept) => kept.system === tag.system && kept.code === tag.code)
      );

      requests.push({
        method: 'PUT',
        url: taskReference,
        ifMatch: makeOptimisticLockIfMatchHeader(task),
        resource: {
          ...task,
          description: next.description,
          encounter: next.encounter,
          location: next.location,
          input: next.input,
          meta: { ...task.meta, tag: [...keptTags, ...addedTags] },
        },
      });
    } else if (step.task?.type === 'attach' && openTask) {
      taskReference = `Task/${openTask.id}`;
      patientId = getTaskPatientId(openTask);

      requests.push(
        getPatchBinary({
          resourceType: 'Task',
          resourceId: openTask.id!,
          patchOperations: getAttachOperations(openTask, step.task.text),
          ifMatch: makeOptimisticLockIfMatchHeader(openTask),
        })
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
