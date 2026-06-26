import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

const OUTREACH_TASK_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/outreach-task`;
const RETRYABLE_STATUSES = ['failed'];

export const index = wrapHandler('retry-outreach-task', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const body = typeof input.body === 'string' ? (JSON.parse(input.body) as Record<string, unknown>) : input.body ?? {};
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  if (!body) throw MISSING_REQUEST_BODY;

  const taskId = body.taskId as string | undefined;
  if (!taskId) throw MISSING_REQUIRED_PARAMETERS(['taskId']);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });

  // Verify this is a scheduled outreach task before allowing retry
  const isOutreachTask = task.meta?.tag?.some((t) => t.system === OUTREACH_TASK_TAG_SYSTEM);
  if (!isOutreachTask) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Task is not a scheduled outreach task and cannot be retried via this endpoint.',
      }),
    };
  }

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

  const operations: ({ op: 'replace'; path: string; value: string } | { op: 'remove'; path: string })[] = [
    { op: 'replace' as const, path: '/status', value: 'requested' },
  ];

  if (task.executionPeriod?.end) {
    operations.push({ op: 'remove' as const, path: '/executionPeriod/end' });
  }

  if (task.output) {
    operations.push({ op: 'remove' as const, path: '/output' });
  }

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations,
  });

  console.log(`retry-outreach-task: reset task ${taskId} to requested (was ${task.status})`);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, taskId }),
  };
});
