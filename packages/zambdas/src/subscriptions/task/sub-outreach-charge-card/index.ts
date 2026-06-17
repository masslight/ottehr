import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import {
  convertOutreachTextToHtml,
  getFullestAvailableName,
  getPatientContactEmail,
  getPhoneNumberForIndividual,
  getSecret,
  getStripeCustomerIdFromAccount,
  getTaskResource,
  isEmailValid,
  maskEmail,
  maskPhoneNumber,
  Secrets,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  ChargeCardConfig,
  NotificationConfig,
  NotificationMedium,
} from '../../../rcm/scheduled-outreach-config/helpers';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  createOutreachEmailCommunication,
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
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  // Mark as in-progress with optimistic locking to guard against duplicate
  // subscription deliveries racing to charge the same card. If another
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

    // Determine current attempt number from task output (previous attempts)
    const currentAttempt = getAttemptCount(task) + 1;

    // Attempt to charge the card
    const chargeResult = await chargeCard(patientRef!, focusRef!, oystehr, input.secrets);

    if (chargeResult.success) {
      // ── Success path: send success notifications and complete ──
      const notificationResults = await sendOutcomeNotifications(
        config.onSuccess,
        task,
        chargeResult,
        oystehr,
        input.secrets
      );

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
              { type: { text: 'attempt-count' }, valueInteger: currentAttempt },
              { type: { text: `attempt-${currentAttempt}-result` }, valueString: 'success' },
              { type: { text: `attempt-${currentAttempt}-date` }, valueDateTime: DateTime.now().toISO() },
              { type: { text: 'charge-result' }, valueString: JSON.stringify(chargeResult) },
              { type: { text: 'notification-results' }, valueString: JSON.stringify(notificationResults) },
              // Preserve previous attempt history
              ...getPreviousAttemptOutputs(task),
            ],
          },
        ],
      });

      console.log(`Task ${task.id} completed successfully on attempt ${currentAttempt}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'completed', attempt: currentAttempt, chargeResult, notificationResults }),
      };
    }

    // ── Failure path: check if retries remain ──
    // currentAttempt is 1-based; retryAttempts is the number of retries AFTER the initial attempt,
    // so retries already used = currentAttempt - 1.
    const retriesRemaining = config.retryAttempts - (currentAttempt - 1);
    console.log(
      `Charge failed on attempt ${currentAttempt}/${config.retryAttempts + 1} (retries remaining: ${retriesRemaining})`
    );

    if (retriesRemaining > 0 && config.retryIntervalDays > 0) {
      // ── Retry: reset task to draft with a future executionPeriod.start ──
      const nextRetryDate = DateTime.now().plus({ days: config.retryIntervalDays }).toISO();
      console.log(`Scheduling retry for task ${task.id} at ${nextRetryDate}`);

      await oystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [
          { op: 'replace', path: '/status', value: 'draft' },
          { op: 'replace', path: '/executionPeriod/start', value: nextRetryDate },
          {
            op: 'add',
            path: '/output',
            value: [
              { type: { text: 'attempt-count' }, valueInteger: currentAttempt },
              { type: { text: `attempt-${currentAttempt}-result` }, valueString: chargeResult.error || 'failed' },
              { type: { text: `attempt-${currentAttempt}-date` }, valueDateTime: DateTime.now().toISO() },
              // Preserve previous attempt history
              ...getPreviousAttemptOutputs(task),
            ],
          },
        ],
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'retry-scheduled',
          attempt: currentAttempt,
          nextRetryDate,
          chargeResult,
        }),
      };
    }

    // ── Final failure: no retries left, send failure notifications and mark failed ──
    const notificationResults = await sendOutcomeNotifications(
      config.onFailure,
      task,
      chargeResult,
      oystehr,
      input.secrets
    );

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'failed' },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [
            { type: { text: 'attempt-count' }, valueInteger: currentAttempt },
            { type: { text: `attempt-${currentAttempt}-result` }, valueString: chargeResult.error || 'failed' },
            { type: { text: `attempt-${currentAttempt}-date` }, valueDateTime: DateTime.now().toISO() },
            { type: { text: 'charge-result' }, valueString: JSON.stringify(chargeResult) },
            { type: { text: 'notification-results' }, valueString: JSON.stringify(notificationResults) },
            // Preserve previous attempt history
            ...getPreviousAttemptOutputs(task),
          ],
        },
      ],
    });

    console.log(`Task ${task.id} failed permanently after ${currentAttempt} attempt(s)`);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'failed', attempt: currentAttempt, chargeResult, notificationResults }),
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

/**
 * Get the number of charge attempts already recorded in the task output.
 */
function getAttemptCount(task: Task): number {
  const attemptOutput = task.output?.find((o) => o.type?.text === 'attempt-count');
  return attemptOutput?.valueInteger ?? 0;
}

/**
 * Extract previous attempt output entries to preserve history when patching.
 */
function getPreviousAttemptOutputs(
  task: Task
): Array<{ type: { text: string }; valueString?: string; valueDateTime?: string; valueInteger?: number }> {
  if (!task.output) return [];
  // Keep all attempt-N-result and attempt-N-date entries from prior attempts
  return task.output
    .filter((o) => {
      const text = o.type?.text || '';
      return /^attempt-\d+-(result|date)$/.test(text);
    })
    .map((o) => ({
      type: { text: o.type!.text! },
      ...(o.valueString !== undefined && { valueString: o.valueString }),
      ...(o.valueDateTime !== undefined && { valueDateTime: o.valueDateTime }),
    }));
}

/**
 * Send notifications for a charge outcome (success or failure).
 */
async function sendOutcomeNotifications(
  notificationConfig: NotificationConfig,
  task: Task,
  chargeResult: ChargeResult,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<{ medium: NotificationMedium; success: boolean; error?: string }[]> {
  const results: { medium: NotificationMedium; success: boolean; error?: string; skipped?: boolean }[] = [];

  if (!notificationConfig.enabled || notificationConfig.mediums.length === 0) {
    return results;
  }

  for (const medium of notificationConfig.mediums) {
    try {
      const { skipped } = await sendNotificationForMedium(
        medium,
        task,
        notificationConfig.smsTemplate,
        notificationConfig.emailTemplate,
        notificationConfig.statementType,
        chargeResult,
        oystehr,
        secrets
      );
      if (skipped) {
        console.log(`[Email] Skipped email notification for task ${task.id}, no email address on file`);
        results.push({ medium, success: true, skipped: true });
      } else {
        results.push({ medium, success: true });
      }
    } catch (err: any) {
      console.log(`Post-charge ${medium} notification not sent:`, err.message);
      results.push({ medium, success: false, error: err.message });
    }
  }

  return results;
}

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
): Promise<{ skipped: boolean }> {
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
    const rawPhone = getPhoneNumberForIndividual(patient);
    if (!rawPhone) {
      throw new Error('No phone number on file');
    }
    const phoneResult = phone(rawPhone, { country: 'USA' });
    if (!phoneResult.isValid) {
      console.log(`Invalid phone number for patient ${patientId}: ${maskPhoneNumber(rawPhone)}`);
      throw new Error('Invalid phone number');
    }

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
      console.log(`Patient ${patientId} has no email address; skipping charge-card outreach email`);
      return { skipped: true };
    }
    if (!isEmailValid(email)) {
      console.log(`Invalid email address for patient ${patientId}: ${maskEmail(email)}`);
      throw new Error('Invalid email address');
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

    // Record email as a FHIR Communication resource
    await createOutreachEmailCommunication({
      oystehr,
      patientId,
      encounterRef: task.focus?.reference,
      recipientEmail: email,
      htmlContent,
      resolvedMessage,
    });
    console.log(`Email notification sent to patient ${patientId} after charge`);
  } else if (medium === 'paper-mail') {
    await sendPaperMailForCharge(task, statementType || 'standard', oystehr);
  } else {
    console.warn(`[NOT IMPLEMENTED] ${medium} notification for charge-card, patient ${patientId}`);
  }
  return { skipped: false };
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
