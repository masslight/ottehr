import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReplySupportChatInputSchema } from 'utils/lib/types/api/support-chat.types';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { practitionerRefForUser } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { notifyPatient } from '../../../shared/support-chat/notify-patient';
import { getTaskPatientId } from '../../../shared/support-chat/request-task';
import {
  buildThreadMessage,
  getThreadIdFromTask,
  isStaffUser,
  searchThread,
  toChatResponse,
} from '../../../shared/support-chat/thread';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

let m2mToken: string;

export const index = wrapHandler('reply-support-chat', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  const { taskId, text, secrets } = validateWithSchema(ReplySupportChatInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const user = await getUser(userToken, secrets);

  if (!isStaffUser(user)) throw NOT_AUTHORIZED;

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  const threadId = getThreadIdFromTask(task);
  const patientId = getTaskPatientId(task);

  if (!threadId || !patientId) throw INVALID_INPUT_ERROR('The task has no support chat');

  const locationId = task.location?.reference?.replace('Location/', '');

  const [sender, patient, location] = await Promise.all([
    practitionerRefForUser(user, oystehr),
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    locationId ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }) : undefined,
  ]);

  await oystehr.fhir.create<Communication>(
    buildThreadMessage({
      threadId,
      kind: 'text',
      text,
      sent: DateTime.now().toISO()!,
      sender,
      patientId,
      taskReference: `Task/${taskId}`,
      taskTitle: task.description,
    })
  );

  await notifyPatient({ patient, location, secrets, oystehr });
  const messages = await searchThread(oystehr, threadId);

  return { statusCode: 200, body: JSON.stringify(toChatResponse(messages, 'staff')) };
});
