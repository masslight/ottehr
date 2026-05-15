import Oystehr from '@oystehr/sdk';
import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { Secrets } from 'utils';
import { getStripeClient } from '../../../../shared';
import { OUTREACH_TASK_TAG_SYSTEM, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceInvoiceDueOutreachResult {
  invoicesEvaluated: number;
  tasksCreated: number;
  tasksSkipped: number;
  tasksCancelled: number;
  errors: number;
}

/**
 * Finds past-due Stripe invoices and creates outreach tasks for the `invoice-due` trigger.
 *
 * Queries Stripe for open invoices with due_date <= today, extracts
 * oystehr_patient_id and oystehr_encounter_id from invoice metadata,
 * and produces outreach tasks using the Encounter as focus.
 */
export async function produceInvoiceDueOutreach(
  oystehr: Oystehr,
  secrets: Secrets
): Promise<ProduceInvoiceDueOutreachResult> {
  const stripe = getStripeClient(secrets);
  const today = DateTime.now().startOf('day');
  const todayUnix = Math.floor(today.toSeconds());

  const pastDueInvoices = await findPastDueStripeInvoices(stripe, todayUnix);

  console.log(`produceInvoiceDueOutreach: Found ${pastDueInvoices.length} past-due Stripe invoices to evaluate`);

  // Collect encounter IDs that still have open invoices so we can cancel stale tasks
  const openEncounterIds = new Set<string>();

  let tasksCreated = 0;
  let tasksSkipped = 0;
  let errors = 0;

  for (const invoice of pastDueInvoices) {
    const patientId = invoice.metadata?.oystehr_patient_id;
    const encounterId = invoice.metadata?.oystehr_encounter_id;

    if (!patientId) {
      console.warn(`Stripe invoice ${invoice.id} has no oystehr_patient_id in metadata, skipping`);
      continue;
    }

    if (!encounterId) {
      console.warn(`Stripe invoice ${invoice.id} has no oystehr_encounter_id in metadata, skipping`);
      continue;
    }

    openEncounterIds.add(encounterId);

    const dueDate = invoice.due_date
      ? DateTime.fromSeconds(invoice.due_date).toISODate()!
      : DateTime.fromSeconds(invoice.created).toISODate()!;

    try {
      // Look up the Encounter to find its linked Appointment for visit date tracking
      let appointmentRef: string | undefined;
      try {
        const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
        appointmentRef = encounter.appointment?.find((ref) => ref.reference?.startsWith('Appointment/'))?.reference;
      } catch (err) {
        console.warn(`Could not fetch Encounter ${encounterId} for appointment lookup:`, err);
      }

      const result = await produceOutreachTasks({
        triggerEvent: 'invoice-due',
        patient: { reference: `Patient/${patientId}` },
        focus: { reference: `Encounter/${encounterId}` },
        appointment: appointmentRef ? { reference: appointmentRef } : undefined,
        eventTimestamp: dueDate,
        oystehr,
      });

      tasksCreated += result.created.length;
      tasksSkipped += result.skipped.length;
    } catch (err) {
      console.error(`Failed to produce outreach tasks for Stripe invoice ${invoice.id}:`, err);
      errors++;
    }
  }

  console.log(
    `produceInvoiceDueOutreach: Created ${tasksCreated} tasks, skipped ${tasksSkipped} (already existing), errors ${errors}`
  );

  // Cancel any pending invoice-due tasks for encounters whose invoices have been paid
  const tasksCancelled = await cancelTasksForPaidInvoices(oystehr, openEncounterIds);

  console.log(`produceInvoiceDueOutreach: Cancelled ${tasksCancelled} stale tasks for paid invoices`);

  return {
    invoicesEvaluated: pastDueInvoices.length,
    tasksCreated,
    tasksSkipped,
    tasksCancelled,
    errors,
  };
}

/**
 * Find Stripe invoices that are open and past their due date.
 * Paginates through all results using auto-pagination.
 */
async function findPastDueStripeInvoices(stripe: Stripe, dueDateLteUnix: number): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.invoices.list({
      status: 'open',
      due_date: { lte: dueDateLteUnix },
      limit: 100,
      starting_after: startingAfter,
    });

    invoices.push(...response.data);
    hasMore = response.has_more;
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  return invoices;
}

/**
 * Cancel any pending (draft/requested) invoice-due outreach tasks whose
 * encounter is no longer associated with an open Stripe invoice (i.e. the
 * invoice has been paid since the task was created).
 */
async function cancelTasksForPaidInvoices(oystehr: Oystehr, openEncounterIds: Set<string>): Promise<number> {
  const pendingTasks = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|invoice-due` },
      { name: 'status', value: 'draft,requested' },
      { name: '_count', value: '500' },
    ],
  });

  const tasks = pendingTasks.unbundle();
  let cancelled = 0;

  for (const task of tasks) {
    const encounterId = task.focus?.reference?.replace('Encounter/', '');
    if (!encounterId) continue;

    if (!openEncounterIds.has(encounterId)) {
      console.log(
        `Cancelling invoice-due task ${task.id} for Encounter/${encounterId} — invoice is no longer open (paid or voided)`
      );
      try {
        await oystehr.fhir.patch<Task>({
          resourceType: 'Task',
          id: task.id!,
          operations: [
            { op: 'replace', path: '/status', value: 'cancelled' },
            {
              op: 'add',
              path: '/statusReason',
              value: { text: 'Invoice is no longer open — paid or voided' },
            },
          ],
        });
        cancelled++;
      } catch (err) {
        console.error(`Failed to cancel stale task ${task.id}:`, err);
      }
    }
  }

  return cancelled;
}
