import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  convertOutreachTextToHtml,
  getFullestAvailableName,
  getPatientContactEmail,
  getSecret,
  getStripeCustomerIdFromAccount,
  getTaskResource,
  Secrets,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import { ChargeCardConfig, NotificationMedium } from '../../../rcm/scheduled-outreach-config/helpers';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillOutreachTemplate,
  getEmailClient,
  getStripeClient,
  resolveTemplatePlaceholders,
  sendSmsForPatient,
  StatementType,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { findStripeInvoiceByEncounterId } from '../../../shared/template-placeholders';

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
    console.log('--- CHARGE CARD CONFIG ---');
    console.log(`[Retry attempts]: ${config.retryAttempts}, every ${config.retryIntervalDays} day(s)`);
    console.log(
      `[On success notify]: enabled=${config.onSuccess.enabled}, mediums=${config.onSuccess.mediums.join(',')}`
    );
    if (config.onSuccess.enabled && config.onSuccess.mediums.includes('sms')) {
      console.log(`[On success SMS]: ${config.onSuccess.smsTemplate}`);
    }
    if (config.onSuccess.enabled && config.onSuccess.mediums.includes('email')) {
      console.log(`[On success Email]: ${config.onSuccess.emailTemplate}`);
    }
    console.log(
      `[On failure notify]: enabled=${config.onFailure.enabled}, mediums=${config.onFailure.mediums.join(',')}`
    );
    if (config.onFailure.enabled && config.onFailure.mediums.includes('sms')) {
      console.log(`[On failure SMS]: ${config.onFailure.smsTemplate}`);
    }
    if (config.onFailure.enabled && config.onFailure.mediums.includes('email')) {
      console.log(`[On failure Email]: ${config.onFailure.emailTemplate}`);
    }
    console.log('--- END CHARGE CARD CONFIG ---');

    // Attempt to charge the card
    const chargeResult = await chargeCard(patientRef!, focusRef!, oystehr, input.secrets);

    // Send appropriate notifications based on outcome
    const notificationConfig = chargeResult.success ? config.onSuccess : config.onFailure;
    const notificationResults: { medium: NotificationMedium; success: boolean; error?: string }[] = [];

    if (notificationConfig.enabled && notificationConfig.mediums.length > 0) {
      for (const medium of notificationConfig.mediums) {
        try {
          await sendNotificationForMedium(
            medium,
            task,
            notificationConfig.smsTemplate,
            notificationConfig.emailTemplate,
            notificationConfig.statementType,
            chargeResult,
            oystehr,
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
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
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
  invoiceLink?: string;
}

/**
 * Charge the patient's card on file via Stripe.
 *
 * Flow:
 * 1. Extract patient ID from the FHIR reference
 * 2. Find the patient's billing Account and its Stripe customer ID
 * 3. Resolve the focus reference (Encounter) to find the open Stripe invoice
 * 4. Call stripe.invoices.pay() to charge the default payment method
 */
async function chargeCard(
  patientRef: string,
  focusRef: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<ChargeResult> {
  const patientId = patientRef.replace('Patient/', '');
  const stripe = getStripeClient(secrets);

  // 1. Find the patient's billing account and Stripe customer
  const { account } = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  if (!account) {
    return { success: false, error: `No billing account found for patient ${patientId}` };
  }

  const stripeCustomerId = getStripeCustomerIdFromAccount(account, undefined);
  if (!stripeCustomerId) {
    return { success: false, error: `No Stripe customer ID on billing account for patient ${patientId}` };
  }

  // 2. Find the Stripe invoice from the focus reference (Encounter-based lookup)
  const encounterId = focusRef.startsWith('Encounter/') ? focusRef.replace('Encounter/', '') : undefined;
  if (!encounterId) {
    return { success: false, error: `Unsupported focus reference format: ${focusRef}. Expected Encounter/<id>` };
  }

  const stripeInvoice = await findStripeInvoiceByEncounterId(stripe, encounterId);
  if (!stripeInvoice) {
    return { success: false, error: `No open Stripe invoice found for encounter ${encounterId}` };
  }

  if (stripeInvoice.status !== 'open') {
    return {
      success: false,
      error: `Stripe invoice ${stripeInvoice.id} is not open (status: ${stripeInvoice.status})`,
    };
  }

  // 3. Verify the customer has a default payment method
  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ['invoice_settings.default_payment_method'],
  });
  if (customer.deleted) {
    return { success: false, error: `Stripe customer ${stripeCustomerId} has been deleted` };
  }
  if (!customer.invoice_settings?.default_payment_method) {
    return { success: false, error: `No default payment method on file for Stripe customer ${stripeCustomerId}` };
  }

  // 4. Attempt to pay the invoice
  console.log(
    `Charging Stripe invoice ${stripeInvoice.id} (amount_due=${stripeInvoice.amount_due}) for customer ${stripeCustomerId}`
  );
  try {
    const paidInvoice = await stripe.invoices.pay(stripeInvoice.id);

    if (paidInvoice.status === 'paid') {
      console.log(`Successfully charged invoice ${stripeInvoice.id}`);
      return {
        success: true,
        transactionId: typeof paidInvoice.charge === 'string' ? paidInvoice.charge : paidInvoice.charge?.id,
        amountCents: stripeInvoice.amount_due,
        invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
      };
    } else {
      return {
        success: false,
        error: `Invoice payment returned status: ${paidInvoice.status}`,
        amountCents: stripeInvoice.amount_due,
        invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
      };
    }
  } catch (err: any) {
    console.error(`Stripe payment failed for invoice ${stripeInvoice.id}:`, err.message);
    return {
      success: false,
      error: err.message || 'Unknown Stripe error',
      amountCents: stripeInvoice.amount_due,
      invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
    };
  }
}

/**
 * Send a post-charge notification to the patient.
 */
async function sendNotificationForMedium(
  medium: NotificationMedium,
  task: Task,
  smsTemplate: string,
  emailTemplate: string,
  statementType: string | undefined,
  chargeResult: ChargeResult,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<void> {
  const patientId = task.for?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Task has no patient reference');

  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientId,
  });

  const placeholderInput = await resolveTemplatePlaceholders({
    patient,
    encounterRef: task.focus?.reference,
    oystehr,
    secrets,
    overrides: {
      amountCents: chargeResult.amountCents,
      invoiceLink: chargeResult.invoiceLink,
    },
  });

  if (medium === 'sms') {
    const resolvedMessage = fillOutreachTemplate(smsTemplate, placeholderInput);

    const unresolved = resolvedMessage.match(/\{\{[\w-]+\}\}/g);
    if (unresolved) {
      const unique = [...new Set(unresolved)];
      console.warn(`Unresolved template placeholders in charge-card SMS: ${unique.join(', ')}`);
    }

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendSmsForPatient(resolvedMessage, oystehr, patient, ENVIRONMENT);
    console.log(`SMS notification sent to patient ${patientId} after charge`);
  } else if (medium === 'email') {
    const email = getPatientContactEmail(patient);
    if (!email) {
      throw new Error(`Patient ${patientId} has no contact email address`);
    }

    const resolvedMessage = fillOutreachTemplate(emailTemplate, placeholderInput);

    const unresolved = resolvedMessage.match(/\{\{[\w-]+\}\}/g);
    if (unresolved) {
      const unique = [...new Set(unresolved)];
      throw new Error(`Unresolved template placeholders: ${unique.join(', ')}`);
    }

    const htmlContent = convertOutreachTextToHtml(resolvedMessage);

    const emailClient = getEmailClient(secrets);
    await emailClient.sendGenericOutreachEmail(email, {
      content: htmlContent,
      'subject-text': 'Update regarding your visit',
    });
    console.log(`Email notification sent to patient ${patientId} after charge`);
  } else if (medium === 'paper-mail') {
    await sendPaperMailForCharge(task, statementType || 'standard', oystehr);
  } else {
    console.warn(`[NOT IMPLEMENTED] ${medium} notification for charge-card, patient ${patientId}`);
  }
}

const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

async function sendPaperMailForCharge(task: Task, statementType: string, oystehr: Oystehr): Promise<void> {
  const patientId = task.for?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Task has no patient reference');

  const encounterRef = task.focus?.reference;
  const encounterId = encounterRef?.replace('Encounter/', '');
  if (!encounterId) throw new Error('Task has no encounter focus reference');

  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });

  const appointmentRef = encounter.appointment?.[0]?.reference;
  const appointmentId = appointmentRef?.split('/')[1];
  if (!appointmentId) throw new Error(`No appointment reference in Encounter/${encounterId}`);

  const [patient, appointment] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId }),
  ]);

  const patientName = getFullestAvailableName(patient);
  const appointmentDate = appointment.start
    ? DateTime.fromISO(appointment.start, { setZone: true }).toFormat('yyyy-MM-dd')
    : 'unknown-date';

  const validType = (['standard', 'past-due', 'final-notice'] as StatementType[]).includes(
    statementType as StatementType
  )
    ? (statementType as StatementType)
    : 'standard';

  const mailTaskInputs: TaskInput[] = [
    {
      type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'statementType' }] },
      valueString: validType,
    },
    {
      type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'color' }] },
      valueString: 'false',
    },
  ];

  const mailTask: Task = {
    ...getTaskResource(
      TaskIndicator.sendPatientStatementByMail,
      `Send statement by mail for ${patientName} visit on ${appointmentDate} (charge-card outreach)`,
      appointmentId,
      encounterId
    ),
    for: { reference: `Patient/${patientId}` },
    input: mailTaskInputs,
  };

  const created = await oystehr.fhir.create<Task>(mailTask);
  console.log(`Created mail statement task ${created.id} (type: ${validType}) for patient ${patientId} after charge`);
}
