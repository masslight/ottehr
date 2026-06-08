import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-log';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('Secrets are not defined');

  const task: Task = JSON.parse(input.body);

  if (task.resourceType !== 'Task') {
    throw new Error(`Expected Task resource but got ${task.resourceType}`);
  }

  if (task.status !== 'requested') {
    console.log(`Task ${task.id} is not in "requested" status (current: ${task.status}), skipping`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Task not in requested status, skipped' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  // Mark as in-progress
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: task.id!,
    operations: [{ op: 'replace', path: '/status', value: 'in-progress' }],
  });

  try {
    const patientRef = task.for?.reference;
    const focusRef = task.focus?.reference;
    const triggerEvent = task.input?.find((i) => i.type?.text === 'trigger-event')?.valueString;
    const actionId = task.input?.find((i) => i.type?.text === 'action-id')?.valueString;

    console.log(`[LOG] Outreach log event executed`);
    console.log(`  Patient: ${patientRef}`);
    console.log(`  Focus: ${focusRef}`);
    console.log(`  Trigger: ${triggerEvent}`);
    console.log(`  Action ID: ${actionId}`);
    console.log(`  Timestamp: ${DateTime.now().toISO()}`);

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'completed' },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { text: 'execution-result' },
              valueString: JSON.stringify({
                logged: true,
                timestamp: DateTime.now().toISO(),
              }),
            },
          ],
        },
      ],
    });

    console.log(`Task ${task.id} completed`);
    return { statusCode: 200, body: JSON.stringify({ status: 'completed' }) };
  } catch (err: any) {
    console.error(`Unexpected error executing task ${task.id}:`, err.message);

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'failed' },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [{ type: { text: 'error' }, valueString: err.message }],
        },
      ],
    });

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
});
