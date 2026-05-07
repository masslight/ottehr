import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { NotificationMedium } from '../../../dunning-config/helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-send-notification';

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
    const mediums = extractMediums(task);
    const smsTemplate = extractInputValue(task, 'sms-template');
    const emailTemplate = extractInputValue(task, 'email-template');
    const patientRef = task.for?.reference;

    console.log(`Executing send-notification for patient ${patientRef}, mediums: ${mediums.join(', ')}`);

    const results: { medium: NotificationMedium; success: boolean; error?: string }[] = [];

    for (const medium of mediums) {
      try {
        switch (medium) {
          case 'sms':
            await sendSms(patientRef!, smsTemplate || '', input.secrets);
            results.push({ medium, success: true });
            break;
          case 'email':
            await sendEmail(patientRef!, emailTemplate || '', input.secrets);
            results.push({ medium, success: true });
            break;
          case 'paper-mail':
            await sendPaperMail(patientRef!, input.secrets);
            results.push({ medium, success: true });
            break;
        }
      } catch (err: any) {
        console.error(`Failed to send ${medium} notification:`, err.message);
        results.push({ medium, success: false, error: err.message });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    const finalStatus = allSucceeded ? 'completed' : 'failed';

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: finalStatus },
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { text: 'execution-result' },
              valueString: JSON.stringify(results),
            },
          ],
        },
      ],
    });

    console.log(`Task ${task.id} completed with status: ${finalStatus}`);
    return { statusCode: 200, body: JSON.stringify({ status: finalStatus, results }) };
  } catch (err: any) {
    console.error(`Unexpected error executing task ${task.id}:`, err.message);

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'failed' },
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

// ── Helpers ────────────────────────────────────────────────────────────────

function extractMediums(task: Task): NotificationMedium[] {
  const mediumsInput = task.input?.find((i) => i.type?.text === 'mediums');
  if (!mediumsInput?.valueString) return [];
  return mediumsInput.valueString.split(',') as NotificationMedium[];
}

function extractInputValue(task: Task, key: string): string | undefined {
  return task.input?.find((i) => i.type?.text === key)?.valueString;
}

// ── Integration placeholders ───────────────────────────────────────────────
// These will be replaced with actual integrations (Twilio, SendGrid, Lob, etc.)

async function sendSms(_patientRef: string, _template: string, _secrets: any): Promise<void> {
  // TODO: Integrate with SMS provider (e.g., Twilio)
  // 1. Resolve patient phone number from FHIR
  // 2. Resolve template placeholders (patient name, amount, etc.)
  // 3. Send via provider
  console.log(`[PLACEHOLDER] Sending SMS to patient ${_patientRef}`);
}

async function sendEmail(_patientRef: string, _template: string, _secrets: any): Promise<void> {
  // TODO: Integrate with email provider (e.g., SendGrid)
  // 1. Resolve patient email from FHIR
  // 2. Resolve template placeholders
  // 3. Send via provider
  console.log(`[PLACEHOLDER] Sending email to patient ${_patientRef}`);
}

async function sendPaperMail(_patientRef: string, _secrets: any): Promise<void> {
  // TODO: Integrate with mail provider (e.g., Lob)
  // 1. Resolve patient mailing address from FHIR
  // 2. Generate statement PDF
  // 3. Send via provider
  console.log(`[PLACEHOLDER] Sending paper mail to patient ${_patientRef}`);
}
