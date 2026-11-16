import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ERX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { FHIR_RESOURCE_NOT_FOUND, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkIsEHRUser, checkOrCreateM2MClientToken, getUser, isTestUser } from '../../shared/auth';
import { isOpen } from '../../shared/erx-refill-requests';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'complete-erx-task';

// Completes an eRx task (a refill request answered in its dialog), only the task of the request answered and never a
// cancelled one. Any staff member may complete one, assigned or not (decision 19), and a patient user never.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, requestId, secrets } = validateRequestParameters(input);

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  if (!user || (!checkIsEHRUser(user) && !isTestUser(user))) throw NOT_AUTHORIZED;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // A missing task, another kind of task, a cancelled one and another request's get the same error, so a caller can't
  // tell whether a Task id exists. A pharmacy's request task is basedOn the eRx service's Task; a patient's is its own.
  const [task] = (
    await oystehr.fhir.search<Task>({ resourceType: 'Task', params: [{ name: '_id', value: taskId }] })
  ).unbundle();
  const category = task?.groupIdentifier?.value;
  const basedOnTask = task?.basedOn?.find((reference) => reference.reference?.startsWith('Task/'))?.reference;
  // The request's sync also completes the task once the eRx service closes the answered request, and can do it first.
  const completed = task?.status === 'completed';
  if (
    !task ||
    (category !== ERX_TASK.category && category !== MANUAL_TASK.category.erx) ||
    (!isOpen(task) && !completed) ||
    (getIdFromReference(basedOnTask, 'Task') ?? task.id) !== requestId
  ) {
    throw FHIR_RESOURCE_NOT_FOUND('Task');
  }
  if (!completed) {
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: taskId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });
  }

  return { statusCode: 200, body: JSON.stringify({ taskId }) };
});
