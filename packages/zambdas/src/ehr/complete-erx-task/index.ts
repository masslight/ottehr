import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { ERX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'complete-erx-task';

// Completes an eRx task (a refill request answered in its dialog); any other task is refused.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
  const category = task.groupIdentifier?.value;
  if (category !== ERX_TASK.category && category !== MANUAL_TASK.category.erx) {
    throw INVALID_INPUT_ERROR(`Task ${taskId} is not an eRx task`);
  }
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [{ op: 'replace', path: '/status', value: 'completed' }],
  });

  return { statusCode: 200, body: JSON.stringify({ taskId }) };
});
