import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

const RETRYABLE_STATUSES = ['failed'];

export const index = wrapHandler('retry-outreach-task', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const body = typeof input.body === 'string' ? (JSON.parse(input.body) as Record<string, unknown>) : input.body ?? {};
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  if (!body) throw MISSING_REQUEST_BODY;

  const taskId = body.taskId as string | undefined;
  if (!taskId) throw MISSING_REQUIRED_PARAMETERS(['taskId']);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

  if (!RETRYABLE_STATUSES.includes(task.status)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Task status "${task.status}" cannot be retried. Only ${RETRYABLE_STATUSES.join(
          ', '
        )} tasks can be retried.`,
      }),
    };
  }

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [
      { op: 'replace', path: '/status', value: 'requested' },
      { op: 'remove', path: '/executionPeriod/end' },
      { op: 'remove', path: '/output' },
    ],
  });

  console.log(`retry-outreach-task: reset task ${taskId} to requested (was ${task.status})`);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, taskId }),
  };
});
