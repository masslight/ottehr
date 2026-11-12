import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice, Task } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  getBillingInvoiceDueDate,
  getHostedInvoiceUrl,
  getStripeInvoiceLink,
  isInvoiceUncollectible,
} from 'utils/lib/fhir/billing-invoice';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY,
  SendBillingOutreachNotificationInput,
  SendBillingOutreachNotificationResponse,
} from 'utils/lib/types/api/invoicing.types';
import { OutreachMediumResult, OutreachStatementType } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { getInvoiceEncounterId } from '../../../billing/invoices';
import { createBillingClient, fetchById } from '../../../billing/shared';
import {
  cancelOutreachTask,
  claimOutreachTask,
  completeOutreachLogTask,
  extractInputValue,
  extractMediums,
  failOutreachTask,
  finishNotificationTask,
  payOpenStripeInvoice,
  runChargeCardTask,
} from '../../../rcm/scheduled-outreach/executors/outreach-task-execution';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { isOutreachInBillingApp } from '../../../shared/invoice-tasks';
import { wrapHandler } from '../../../shared/sentry';
import { getStripeClient } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-billing-outreach-task';

type BillingOutreachTaskResult =
  | { status: 'cancelled'; reason: string }
  | { status: 'completed' }
  | Awaited<ReturnType<typeof runChargeCardTask>>
  | { status: Awaited<ReturnType<typeof finishNotificationTask>>; results: OutreachMediumResult[] };

type BillingOutreachNotification = Omit<SendBillingOutreachNotificationInput, 'encounterId' | 'dueDate'>;

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
  const oystehr = createBillingClient(m2mToken, input.secrets);

  // A requested Task is never promoted again, so leaving it would strand it.
  if (!isOutreachInBillingApp(input.secrets)) {
    const reason = 'Outreach is not enabled in the billing app';
    await cancelOutreachTask(oystehr, task, reason);
    return { statusCode: 200, body: JSON.stringify({ status: 'cancelled', reason }) };
  }

  if (!(await claimOutreachTask(oystehr, task))) {
    return { statusCode: 200, body: JSON.stringify({ message: 'Task already claimed, skipped' }) };
  }

  try {
    const result = await performEffect(oystehr, getStripeClient(input.secrets), task);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error executing task ${task.id}:`, message);

    await failOutreachTask(oystehr, task, message);

    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
});

export async function performEffect(oystehr: Oystehr, stripe: Stripe, task: Task): Promise<BillingOutreachTaskResult> {
  const invoiceId = getIdFromReference(task.focus?.reference, 'Invoice');
  if (!invoiceId) throw new Error(`Task ${task.id} has no Invoice focus`);
  const invoice = await fetchById<Invoice>(oystehr, 'Invoice', invoiceId);

  // A payment can land between scheduling and execution.
  if (invoice.status !== 'issued' || isInvoiceUncollectible(invoice)) {
    return cancel(oystehr, task, 'Invoice is no longer open');
  }

  const action = task.code?.coding?.find((coding) => coding.system === BILLING_OUTREACH_TASK_CODE_SYSTEM)?.code;
  if (action === 'log') {
    await completeOutreachLogTask(oystehr, task);
    return { status: 'completed' };
  }
  if (action !== 'charge-card' && action !== 'send-notification') {
    throw new Error(`Unsupported billing outreach action: ${action}`);
  }

  const link = getStripeInvoiceLink(invoice);
  if (!link) throw new Error(`Invoice ${invoice.id} is not linked to a Stripe invoice`);
  const { stripeInvoiceId, stripeAccount } = link;
  const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, undefined, { stripeAccount });
  // Stripe may know of a payment the webhook has not recorded yet.
  if (stripeInvoice.status !== 'open') {
    return cancel(oystehr, task, `Stripe invoice is ${stripeInvoice.status}`);
  }
  const invoiceLink = stripeInvoice.hosted_invoice_url ?? getHostedInvoiceUrl(invoice);
  // What is still owed. amount_due stays at the full total after a partial payment.
  const amountCents = stripeInvoice.amount_remaining;

  if (action === 'charge-card') {
    const customer = stripeInvoice.customer;
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    return runChargeCardTask({
      oystehr,
      task,
      charge: async () =>
        customerId
          ? { ...(await payOpenStripeInvoice(stripe, stripeInvoice, customerId, stripeAccount)), amountCents }
          : { success: false, error: 'Stripe invoice has no customer', stripeAccount },
      // A delivery failure must not turn the charge result into a failed Task.
      notify: async (config, chargeResult) => {
        if (!config.enabled || !config.mediums.length) return [];
        try {
          return await sendNotification(oystehr, invoice, {
            mediums: config.mediums,
            smsTemplate: config.smsTemplate,
            emailTemplate: config.emailTemplate,
            statementType: config.statementType,
            chargeOutcome: true,
            amountCents,
            invoiceLink: chargeResult.invoiceLink ?? invoiceLink,
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.error(`Charge outcome notification for task ${task.id} failed:`, error);
          return config.mediums.map((medium) => ({ medium, success: false, error }));
        }
      },
    });
  }

  const mediums = extractMediums(task);
  // The clinical endpoint rejects an empty medium list.
  const results = mediums.length
    ? await sendNotification(oystehr, invoice, {
        mediums,
        smsTemplate: extractInputValue(task, 'sms-template'),
        emailTemplate: extractInputValue(task, 'email-template'),
        statementType: extractInputValue(task, 'statement-type') as OutreachStatementType | undefined,
        amountCents,
        invoiceLink,
      })
    : [];
  return { status: await finishNotificationTask(oystehr, task, results), results };
}

async function cancel(oystehr: Oystehr, task: Task, reason: string): Promise<BillingOutreachTaskResult> {
  await cancelOutreachTask(oystehr, task, reason);
  return { status: 'cancelled', reason };
}

// Delivery runs in the clinical workspace, which holds the patient's contacts and messaging.
async function sendNotification(
  oystehr: Oystehr,
  invoice: Invoice,
  notification: BillingOutreachNotification
): Promise<OutreachMediumResult[]> {
  const encounterId = await getInvoiceEncounterId(oystehr, invoice.id!);
  const response = chooseJson<SendBillingOutreachNotificationResponse>(
    await oystehr.zambda.execute({
      id: SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY,
      encounterId,
      // The FHIR due date, since Stripe's timestamp can shift the day by time zone.
      dueDate: getBillingInvoiceDueDate(invoice),
      ...notification,
    })
  );
  return response.results;
}
