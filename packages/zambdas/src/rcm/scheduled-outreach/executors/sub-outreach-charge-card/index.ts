import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { ChargeCardConfig, NotificationMedium } from '../../../scheduled-outreach-config/helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-charge-card';

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
    const config = extractChargeCardConfig(task);
    const patientRef = task.for?.reference;
    const focusRef = task.focus?.reference;

    console.log(`Executing charge-card for patient ${patientRef}, focus ${focusRef}`);

    // Attempt to charge the card
    const chargeResult = await chargeCard(patientRef!, focusRef!, input.secrets);

    // Send appropriate notifications based on outcome
    const notificationConfig = chargeResult.success ? config.onSuccess : config.onFailure;
    const notificationResults: { medium: NotificationMedium; success: boolean; error?: string }[] = [];

    if (notificationConfig.enabled && notificationConfig.mediums.length > 0) {
      for (const medium of notificationConfig.mediums) {
        try {
          await sendNotificationForMedium(
            medium,
            patientRef!,
            notificationConfig.smsTemplate,
            notificationConfig.emailTemplate,
            input.secrets
          );
          notificationResults.push({ medium, success: true });
        } catch (err: any) {
          console.error(`Failed to send ${medium} notification after charge:`, err.message);
          notificationResults.push({ medium, success: false, error: err.message });
        }
      }
    }

    const finalStatus = chargeResult.success ? 'completed' : 'failed';

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
              type: { text: 'charge-result' },
              valueString: JSON.stringify(chargeResult),
            },
            {
              type: { text: 'notification-results' },
              valueString: JSON.stringify(notificationResults),
            },
          ],
        },
      ],
    });

    console.log(`Task ${task.id} completed with status: ${finalStatus}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: finalStatus, chargeResult, notificationResults }),
    };
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

function extractChargeCardConfig(task: Task): ChargeCardConfig {
  const configInput = task.input?.find((i) => i.type?.text === 'charge-card-config');
  if (!configInput?.valueString) {
    throw new Error('charge-card-config not found in task input');
  }
  return JSON.parse(configInput.valueString) as ChargeCardConfig;
}

// ── Integration placeholders ───────────────────────────────────────────────

interface ChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  amountCents?: number;
}

async function chargeCard(_patientRef: string, _focusRef: string, _secrets: any): Promise<ChargeResult> {
  // TODO: Integrate with Stripe
  // 1. Resolve patient's payment method from FHIR Account / Stripe customer
  // 2. Resolve invoice amount from focus resource
  // 3. Charge via Stripe API
  // 4. Return result
  console.log(`[PLACEHOLDER] Charging card for patient ${_patientRef}, invoice ${_focusRef}`);
  return { success: true, transactionId: 'placeholder-txn-id', amountCents: 0 };
}

async function sendNotificationForMedium(
  medium: NotificationMedium,
  _patientRef: string,
  _smsTemplate: string,
  _emailTemplate: string,
  _secrets: any
): Promise<void> {
  // TODO: Reuse notification sending logic
  console.log(`[PLACEHOLDER] Sending ${medium} notification to patient ${_patientRef} after charge`);
}
