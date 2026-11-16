import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { ERX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { FHIR_RESOURCE_NOT_FOUND, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkIsEHRUser, checkOrCreateM2MClientToken, getUser, isTestUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'complete-erx-task';

// Completes an eRx task (a refill request answered in its dialog); any other task is refused. Any staff member may
// complete one, assigned or not (decision 19), and a patient user never.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateRequestParameters(input);

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  if (!user || (!checkIsEHRUser(user) && !isTestUser(user))) throw NOT_AUTHORIZED;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // A missing task and another kind of task get the same error, so a caller can't tell whether a Task id exists.
  const [task] = (
    await oystehr.fhir.search<Task>({ resourceType: 'Task', params: [{ name: '_id', value: taskId }] })
  ).unbundle();
  const category = task?.groupIdentifier?.value;
  if (category !== ERX_TASK.category && category !== MANUAL_TASK.category.erx) {
    throw FHIR_RESOURCE_NOT_FOUND('Task');
  }
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [{ op: 'replace', path: '/status', value: 'completed' }],
  });

  return { statusCode: 200, body: JSON.stringify({ taskId }) };
});
