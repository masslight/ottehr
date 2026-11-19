import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import { getStripeCustomerIdFromAccount, getTaskResource } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName, getPatientContactEmail, getPhoneNumberForIndividual } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { convertOutreachTextToHtml, isEmailValid, maskEmail, maskPhoneNumber } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { NotificationConfig, NotificationMedium } from 'utils/lib/types/api/scheduled-outreach.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { getAccountAndCoverageResourcesForPatient } from '../../../ehr/shared/harvest';
import {
  ChargeResult,
  claimOutreachTask,
  failOutreachTask,
  payOpenStripeInvoice,
  runChargeCardTask,
} from '../../../rcm/scheduled-outreach/executors/outreach-task-execution';
import { resolveOutreachTaskStripeAccount } from '../../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createOutreachEmailCommunication, getEmailClient, sendSmsForPatient } from '../../../shared/communication';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { StatementType } from '../../../shared/statements/get-statement-details';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { fillOutreachTemplate, resolveTemplatePlaceholders } from '../../../shared/template-placeholders';
import { findStripeInvoiceByEncounterId } from '../../../shared/template-placeholders';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-charge-card';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('Secrets are not defined');

  const task: Task = safeJsonParse(input.body);

  if (task.resourceType !== 'Task') {
    throw new Error(`Expected Task resource but got ${task.resourceType}`);
  }

  if (task.status !== 'requested') {
    console.log(`Task ${task.id} is not in "requested" status (current: ${task.status}), skipping`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Task not in requested status, skipped' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  if (!(await claimOutreachTask(oystehr, task))) {
    return { statusCode: 200, body: JSON.stringify({ message: 'Task already claimed, skipped' }) };
  }

  try {
    const result = await runChargeCardTask({
      oystehr,
      task,
      charge: () => chargeCard(task, oystehr, input.secrets),
      notify: (config, chargeResult) => sendOutcomeNotifications(config, task, chargeResult, oystehr, input.secrets),
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err: any) {
    console.error(`Unexpected error executing task ${task.id}:`, err.message);

    await failOutreachTask(oystehr, task, err.message);

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

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
  const results: { medium: NotificationMedium; success: boolean; error?: string }[] = [];

  if (!notificationConfig.enabled || notificationConfig.mediums.length === 0) {
    return results;
  }

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
        secrets
      );
      results.push({ medium, success: true });
    } catch (err: any) {
      console.log(`Post-charge ${medium} notification not sent:`, err.message);
      results.push({ medium, success: false, error: err.message });
    }
  }

  return results;
}

// ── Integration placeholders ───────────────────────────────────────────────

/**
 * Charge the patient's card on file via Stripe.
 *
 * Flow:
 * 1. Extract patient ID from the FHIR reference
 * 2. Find the patient's billing Account and its Stripe customer ID
 * 3. Resolve the focus reference (Encounter) to find the open Stripe invoice
 * 4. Call stripe.invoices.pay() to charge the default payment method
 */
async function chargeCard(task: Task, oystehr: Oystehr, secrets: Secrets | null): Promise<ChargeResult> {
  const patientRef = task.for?.reference ?? '';
  const focusRef = task.focus?.reference ?? '';
  const patientId = patientRef.replace('Patient/', '');
  const stripe = getStripeClient(secrets);

  const encounterId = focusRef.startsWith('Encounter/') ? focusRef.replace('Encounter/', '') : undefined;
  if (!encounterId) {
    return { success: false, error: `Unsupported focus reference format: ${focusRef}. Expected Encounter/<id>` };
  }

  const stripeAccount = await resolveOutreachTaskStripeAccount(task, oystehr);

  // 1. Find the patient's billing account and Stripe customer
  const { account } = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  if (!account) {
    return { success: false, error: `No billing account found for patient ${patientId}`, stripeAccount };
  }

  const stripeCustomerId = getStripeCustomerIdFromAccount(account, stripeAccount);
  if (!stripeCustomerId) {
    return {
      success: false,
      error: `No Stripe customer ID on billing account for patient ${patientId} (Stripe account: ${
        stripeAccount ?? 'platform'
      })`,
      stripeAccount,
    };
  }

  // 2. Find the Stripe invoice from the focus reference (Encounter-based lookup)
  const stripeInvoice = await findStripeInvoiceByEncounterId(stripe, encounterId, stripeAccount);
  if (!stripeInvoice) {
    return { success: false, error: `No open Stripe invoice found for encounter ${encounterId}`, stripeAccount };
  }

  return payOpenStripeInvoice(stripe, stripeInvoice, stripeCustomerId, stripeAccount);
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
    stripeAccount: chargeResult.stripeAccount,
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
    if (!resolvedMessage.trim()) {
      throw new Error('Outreach SMS template is empty');
    }

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
      throw new Error('No email address on file');
    }
    if (!isEmailValid(email)) {
      console.log(`Invalid email address for patient ${patientId}: ${maskEmail(email)}`);
      throw new Error('Invalid email address');
    }

    const resolvedMessage = fillOutreachTemplate(emailTemplate, placeholderInput);
    if (!resolvedMessage.trim()) {
      throw new Error('Outreach email template is empty');
    }

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
  const appointmentId = getIdFromReference(appointmentRef);
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
