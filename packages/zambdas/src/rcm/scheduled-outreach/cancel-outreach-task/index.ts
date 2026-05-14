import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

const CANCELLABLE_STATUSES = ['draft', 'requested'];

export const index = wrapHandler('cancel-outreach-task', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const body = typeof input.body === 'string' ? (JSON.parse(input.body) as Record<string, unknown>) : input.body ?? {};
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  if (!body) throw MISSING_REQUEST_BODY;

  const taskId = body.taskId as string | undefined;
  if (!taskId) throw MISSING_REQUIRED_PARAMETERS(['taskId']);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

  if (!CANCELLABLE_STATUSES.includes(task.status)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Task status "${task.status}" cannot be cancelled. Only ${CANCELLABLE_STATUSES.join(
          ', '
        )} tasks can be cancelled.`,
      }),
    };
  }

  const operations: { op: 'replace' | 'add'; path: string; value: string }[] = [
    { op: 'replace', path: '/status', value: 'cancelled' },
  ];

  // Only set executionPeriod.end if it won't violate start <= end constraint
  const now = DateTime.now();
  const start = task.executionPeriod?.start ? DateTime.fromISO(task.executionPeriod.start) : null;
  if (!start || now >= start) {
    operations.push({ op: 'add', path: '/executionPeriod/end', value: now.toISO()! });
  }

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations,
  });

  console.log(`cancel-outreach-task: cancelled task ${taskId} (was ${task.status})`);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, taskId }),
  };
});
