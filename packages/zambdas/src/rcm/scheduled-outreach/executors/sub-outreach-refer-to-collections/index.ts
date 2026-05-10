import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';

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

  // Mark as in-progress
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: task.id!,
    operations: [{ op: 'replace', path: '/status', value: 'in-progress' }],
  });

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

    // TODO: Implement collections referral integration
    // 1. Gather patient demographics, balance, payment history from FHIR
    // 2. Format data per agency requirements
    // 3. Submit via agency API (SFTP, REST, etc.)
    // 4. Record referral in FHIR (e.g., ServiceRequest or flag on Account)

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
              valueString: JSON.stringify({ placeholder: true, agency: config.agency }),
            },
          ],
        },
      ],
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'completed', placeholder: true }) };
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
