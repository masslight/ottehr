import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-refer-to-collections';

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
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  // Mark as in-progress with optimistic locking to guard against duplicate
  // subscription deliveries racing to execute the same task. If another
  // invocation already claimed it, the version will be stale (412) and we skip.
  try {
    await oystehr.fhir.patch<Task>(
      {
        resourceType: 'Task',
        id: task.id!,
        operations: [{ op: 'replace', path: '/status', value: 'in-progress' }],
      },
      { optimisticLockingVersionId: task.meta?.versionId }
    );
  } catch (err) {
    if (err instanceof Oystehr.OystehrFHIRError && err.code === 412) {
      console.log(`Task ${task.id} was already claimed by another invocation (version conflict), skipping`);
      return { statusCode: 200, body: JSON.stringify({ message: 'Task already claimed, skipped' }) };
    }
    throw err;
  }

  try {
    const patientRef = task.for?.reference;
    const focusRef = task.focus?.reference;
    const configInput = task.input?.find((i) => i.type?.text === 'refer-to-collections-config');
    const config = configInput?.valueString ? JSON.parse(configInput.valueString) : {};

    console.log(
      `[PLACEHOLDER] Referring patient ${patientRef} (invoice: ${focusRef}) to collections agency: ${
        config.agency || 'unknown'
      }`
    );
    console.log('--- COLLECTIONS REFERRAL CONFIG ---');
    console.log(`[Agency]: ${config.agency || '(none)'}`);
    console.log(`[Minimum balance]: $${config.minimumBalance || 0}`);
    console.log(`[Include payment history]: ${config.includePaymentHistory || false}`);
    console.log('--- END COLLECTIONS REFERRAL CONFIG ---');

    // Collections referral integration is not yet implemented.
    // Mark the task as rejected with a businessStatus so the state is explicit and queryable.
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'rejected' },
        {
          op: 'add',
          path: '/businessStatus',
          value: {
            coding: [
              {
                system: 'https://ottehr.com/CodeSystem/outreach-task-business-status',
                code: 'not-implemented',
                display: 'Feature not yet implemented',
              },
            ],
          },
        },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { text: 'error' },
              valueString: 'Collections referral integration is not yet implemented.',
            },
          ],
        },
      ],
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'rejected', reason: 'not-yet-implemented' }) };
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
