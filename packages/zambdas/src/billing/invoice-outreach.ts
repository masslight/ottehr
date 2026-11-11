import Oystehr from '@oystehr/sdk';
import { Invoice, Task } from 'fhir/r4b';
import { getBillingInvoiceKind, getStripeInvoiceLink } from 'utils/lib/fhir/billing-invoice';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import {
  OUTREACH_PLATFORM_STRIPE_ACCOUNT,
  OUTREACH_TASK_TAG_SYSTEM,
  OutreachTaskResult,
  produceOutreachTasks,
} from '../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';

// A repeat skips actions that already have a Task for this invoice. A cancelled Task does not
// count, so that action is scheduled again.
export async function produceBillingInvoiceIssuedOutreach(
  oystehr: Oystehr,
  invoice: Invoice
): Promise<OutreachTaskResult> {
  // NIO invoices bill an organization, and outreach contacts patients.
  if (getBillingInvoiceKind(invoice) !== 'patient') return { created: [], skipped: [] };
  if (!invoice.subject || !invoice.date) throw new Error(`Invoice ${invoice.id} has no patient or date`);

  return produceOutreachTasks({
    triggerEvent: 'invoice-issued',
    patient: invoice.subject,
    focus: { reference: `Invoice/${invoice.id}` },
    // The date saved when the draft was created rather than the current time, so a repeat
    // schedules the same times.
    eventTimestamp: invoice.date,
    oystehr,
    stripeAccount: getStripeInvoiceLink(invoice)?.stripeAccount ?? OUTREACH_PLATFORM_STRIPE_ACCOUNT,
    taskCodeSystem: BILLING_OUTREACH_TASK_CODE_SYSTEM,
    // The billing patient is a copy, and its contact details may be out of date.
    skipContactValidation: true,
  });
}

// Cancels outreach that has not started.
export async function cancelPendingInvoiceOutreach(oystehr: Oystehr, invoiceId: string, reason: string): Promise<void> {
  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'focus', value: `Invoice/${invoiceId}` },
        { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|` },
        { name: 'status', value: 'draft,requested' },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  for (const task of tasks) {
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'cancelled' },
        { op: 'add', path: '/statusReason', value: { text: reason } },
      ],
    });
  }
  if (tasks.length) console.log(`Cancelled ${tasks.length} outreach Tasks for Invoice/${invoiceId}: ${reason}`);
}
