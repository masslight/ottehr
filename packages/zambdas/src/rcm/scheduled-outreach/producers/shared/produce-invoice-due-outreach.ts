import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { Secrets } from 'utils';
import { getStripeClient } from '../../../../shared';
import { produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceInvoiceDueOutreachResult {
  invoicesEvaluated: number;
  tasksCreated: number;
  tasksSkipped: number;
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

  return {
    invoicesEvaluated: pastDueInvoices.length,
    tasksCreated,
    tasksSkipped,
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
