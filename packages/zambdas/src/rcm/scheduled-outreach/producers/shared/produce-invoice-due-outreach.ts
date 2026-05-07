import Oystehr from '@oystehr/sdk';
import { Invoice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { INVALID_INPUT_ERROR, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceInvoiceDueOutreachResult {
  invoicesEvaluated: number;
  tasksCreated: number;
  tasksSkipped: number;
}

/**
 * Finds past-due invoices and creates outreach tasks for the `invoice-due` trigger.
 *
 * Can be called directly from another zambda or from the cron handler.
 */
export async function produceInvoiceDueOutreach(oystehr: Oystehr): Promise<ProduceInvoiceDueOutreachResult> {
  const today = DateTime.now().toISODate()!;

  const pastDueInvoices = await findPastDueInvoices(oystehr, today);

  console.log(`produceInvoiceDueOutreach: Found ${pastDueInvoices.length} past-due invoices to evaluate`);

  let tasksCreated = 0;
  let tasksSkipped = 0;

  for (const invoice of pastDueInvoices) {
    if (!invoice.subject?.reference) {
      console.warn(`Invoice ${invoice.id} has no subject reference, skipping`);
      continue;
    }

    const dueDate = extractDueDate(invoice) || invoice.date || today;

    const result = await produceOutreachTasks({
      triggerEvent: 'invoice-due',
      patient: invoice.subject,
      focus: { reference: `Invoice/${invoice.id}` },
      eventTimestamp: dueDate,
      oystehr,
    });

    tasksCreated += result.created.length;
    tasksSkipped += result.skipped.length;
  }

  console.log(`produceInvoiceDueOutreach: Created ${tasksCreated} tasks, skipped ${tasksSkipped} (already existing)`);

  return {
    invoicesEvaluated: pastDueInvoices.length,
    tasksCreated,
    tasksSkipped,
  };
}

/**
 * Produce outreach tasks for a single invoice that is known to be past-due.
 * Useful when another zambda already has the invoice and doesn't need the cron to find it.
 */
export async function produceInvoiceDueOutreachForInvoice(
  invoice: Invoice,
  oystehr: Oystehr
): Promise<OutreachTaskResult> {
  if (!invoice.subject?.reference) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoice.id} has no subject (patient) reference`);
  }

  const dueDate = extractDueDate(invoice) || invoice.date || DateTime.now().toISODate()!;

  return produceOutreachTasks({
    triggerEvent: 'invoice-due',
    patient: invoice.subject,
    focus: { reference: `Invoice/${invoice.id}` },
    eventTimestamp: dueDate,
    oystehr,
  });
}

/**
 * Find invoices that are past their due date and still have an outstanding balance.
 */
async function findPastDueInvoices(oystehr: Oystehr, today: string): Promise<Invoice[]> {
  const bundle = await oystehr.fhir.search<Invoice>({
    resourceType: 'Invoice',
    params: [
      { name: 'status', value: 'issued' },
      { name: '_count', value: '200' },
    ],
  });

  const invoices = bundle.unbundle();

  return invoices.filter((inv: Invoice) => {
    const dueDate = extractDueDate(inv);
    if (!dueDate) return false;
    return dueDate <= today;
  });
}

/**
 * Extract the due date from an Invoice.
 * Looks for paymentTerms or a due-date extension.
 */
function extractDueDate(invoice: Invoice): string | undefined {
  const dueDateExt = invoice.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/invoice-due-date`);
  if (dueDateExt?.valueDate) return dueDateExt.valueDate;
  if (dueDateExt?.valueDateTime) return dueDateExt.valueDateTime.substring(0, 10);

  return undefined;
}
