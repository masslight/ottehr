import Oystehr from '@oystehr/sdk';
import { Invoice, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceDueDate,
  getBillingInvoiceKind,
  getStripeInvoiceLink,
  INVOICE_ISSUED_FROM_EHR_TAG,
  isInvoiceUncollectible,
} from 'utils/lib/fhir/billing-invoice';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { resourceHasTag } from 'utils/lib/fhir/helpers';
import { OutreachAction, TriggerEvent } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import {
  calculateEarliestEligibleDueDate,
  ProduceInvoiceDueOutreachResult,
  selectApplicableInvoiceDueActionIds,
} from '../rcm/scheduled-outreach/producers/shared/produce-invoice-due-outreach';
import {
  OUTREACH_PLATFORM_STRIPE_ACCOUNT,
  OUTREACH_TASK_TAG_SYSTEM,
  OutreachTaskResult,
  produceOutreachTasks,
} from '../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { getOrCreateOutreachConfig, parsePlanDefinitionToActions } from '../rcm/scheduled-outreach-config/helpers';

// A repeat skips actions that already have a Task for this invoice. A cancelled Task does not
// count unless staff cancelled it, so that action is scheduled again.
export async function produceBillingInvoiceIssuedOutreach(
  oystehr: Oystehr,
  invoice: Invoice
): Promise<OutreachTaskResult> {
  // The saved issue date rather than the current time, so a repeat schedules the same times.
  return produceBillingInvoiceOutreach(oystehr, invoice, 'invoice-issued', invoice.date);
}

// The due date is an extension, so it cannot be searched on and is filtered here. There is no
// cancel sweep: the billing Stripe webhook cancels pending outreach when an invoice is paid, voided or
// marked uncollectible.
export async function produceBillingInvoiceDueOutreach(
  oystehr: Oystehr
): Promise<Omit<ProduceInvoiceDueOutreachResult, 'tasksCancelled'>> {
  const result = { invoicesEvaluated: 0, tasksCreated: 0, tasksSkipped: 0, errors: 0 };
  const actions = parsePlanDefinitionToActions(await getOrCreateOutreachConfig(oystehr)).filter(
    (action) => action.trigger.event === 'invoice-due' && action.enabled !== false
  );
  if (!actions.length) return result;

  const today = DateTime.now().toISODate()!;
  const earliestDueDateUnix = await calculateEarliestEligibleDueDate(oystehr);
  const earliestDueDate =
    earliestDueDateUnix === undefined ? undefined : DateTime.fromSeconds(earliestDueDateUnix).toISODate()!;

  const invoices = await getAllFhirSearchPages<Invoice>(
    { resourceType: 'Invoice', params: [{ name: 'status', value: 'issued' }] },
    oystehr
  );
  for (const invoice of invoices) {
    const dueDate = getBillingInvoiceDueDate(invoice);
    // Included from the due date itself, so an action set at 0 days runs that day.
    if (!dueDate || dueDate > today || (earliestDueDate && dueDate < earliestDueDate)) continue;
    result.invoicesEvaluated++;
    try {
      const actionIds = selectApplicableInvoiceDueActionIds(actions, dueDate);
      if (!actionIds.size) continue;
      const { created, skipped } = await produceBillingInvoiceOutreach(
        oystehr,
        invoice,
        'invoice-due',
        dueDate,
        (action) => actionIds.has(action.id)
      );
      result.tasksCreated += created.length;
      result.tasksSkipped += skipped.length;
    } catch (err) {
      console.error(`Failed to produce invoice-due outreach for Invoice/${invoice.id}:`, err);
      result.errors++;
    }
  }
  return result;
}

async function produceBillingInvoiceOutreach(
  oystehr: Oystehr,
  invoice: Invoice,
  triggerEvent: TriggerEvent,
  eventTimestamp: string | undefined,
  actionFilter?: (action: OutreachAction) => boolean
): Promise<OutreachTaskResult> {
  // No outreach for NIO invoices, uncollectible ones, or copies of invoices the EHR sent.
  if (
    getBillingInvoiceKind(invoice) !== 'patient' ||
    isInvoiceUncollectible(invoice) ||
    resourceHasTag(invoice, INVOICE_ISSUED_FROM_EHR_TAG)
  ) {
    return { created: [], skipped: [] };
  }
  if (!invoice.subject || !eventTimestamp) throw new Error(`Invoice ${invoice.id} has no patient or date`);

  return produceOutreachTasks({
    triggerEvent,
    patient: invoice.subject,
    focus: { reference: `Invoice/${invoice.id}` },
    eventTimestamp,
    oystehr,
    stripeAccount: getStripeInvoiceLink(invoice)?.stripeAccount ?? OUTREACH_PLATFORM_STRIPE_ACCOUNT,
    taskCodeSystem: BILLING_OUTREACH_TASK_CODE_SYSTEM,
    // The billing patient is a copy, and its contact details may be out of date.
    skipContactValidation: true,
    actionFilter,
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
    await oystehr.fhir.patch<Task>(
      {
        resourceType: 'Task',
        id: task.id!,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: reason } },
        ],
      },
      // Fails if the Task changed after the search, so one that has started is not overwritten.
      { optimisticLockingVersionId: task.meta?.versionId }
    );
  }
  if (tasks.length) console.log(`Cancelled ${tasks.length} outreach Tasks for Invoice/${invoiceId}: ${reason}`);
}
