import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  ChargeCardConfig,
  NotificationConfig,
  OutreachMediumResult,
} from 'utils/lib/types/api/scheduled-outreach.types';

export async function claimOutreachTask(oystehr: Oystehr, task: Task): Promise<boolean> {
  // Mark as in-progress with optimistic locking to guard against duplicate
  // subscription deliveries racing to execute the same task. If another
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
    return true;
  } catch (err) {
    if (err instanceof Oystehr.OystehrFHIRError && err.code === 412) {
      console.log(`Task ${task.id} was already claimed by another invocation (version conflict), skipping`);
      return false;
    }
    throw err;
  }
}

export async function failOutreachTask(oystehr: Oystehr, task: Task, message: string): Promise<void> {
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: task.id!,
    operations: [
      { op: 'replace', path: '/status', value: 'failed' },
      { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
      {
        op: 'add',
        path: '/output',
        value: [{ type: { text: 'error' }, valueString: message }],
      },
    ],
  });
}

export async function finishNotificationTask(
  oystehr: Oystehr,
  task: Task,
  results: OutreachMediumResult[]
): Promise<'completed' | 'cancelled' | 'failed'> {
  const allSucceeded = results.every((r) => r.success);
  const anySucceeded = results.some((r) => r.success);
  const allSkippedDueToContacts = !allSucceeded && results.every((r) => r.success || !!r.skippedReason);

  // If at least one medium succeeded, treat the task as completed.
  // Only cancel if every medium was skipped due to invalid contacts.
  // Only fail if no medium succeeded and at least one had a real (non-contact) error.
  const finalStatus = allSucceeded || anySucceeded ? 'completed' : allSkippedDueToContacts ? 'cancelled' : 'failed';

  // Log per-medium failures even when the task overall succeeds
  const failedMediums = results.filter((r) => !r.success);
  if (failedMediums.length > 0 && finalStatus === 'completed') {
    console.log(
      `Task ${task.id} completed with partial medium failures: ${failedMediums
        .map((r) => `${r.medium}: ${r.error || r.skippedReason}`)
        .join('; ')}`
    );
  }

  const patchOps: { op: 'replace' | 'add'; path: string; value: unknown }[] = [
    { op: 'replace', path: '/status', value: finalStatus },
    { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
    {
      op: 'add',
      path: '/output',
      value: [
        {
          type: { text: 'execution-result' },
          valueString: JSON.stringify(results),
        },
      ],
    },
  ];

  if (allSkippedDueToContacts) {
    const reasons = results.filter((r) => r.skippedReason).map((r) => `${r.medium}: ${r.skippedReason}`);
    patchOps.push({
      op: 'add',
      path: '/statusReason',
      value: { text: `No valid contact methods: ${reasons.join('; ')}` },
    });
  }

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: task.id!,
    operations: patchOps,
  });

  console.log(`Task ${task.id} completed with status: ${finalStatus}`);
  return finalStatus;
}

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  amountCents?: number;
  invoiceLink?: string;
  stripeAccount?: string;
}

export async function runChargeCardTask(params: {
  oystehr: Oystehr;
  task: Task;
  charge: () => Promise<ChargeResult>;
  notify: (config: NotificationConfig, chargeResult: ChargeResult) => Promise<OutreachMediumResult[]>;
}): Promise<
  | { status: 'completed'; attempt: number; chargeResult: ChargeResult; notificationResults: OutreachMediumResult[] }
  | { status: 'retry-scheduled'; attempt: number; nextRetryDate: string; chargeResult: ChargeResult }
  | { status: 'failed'; attempt: number; chargeResult: ChargeResult; notificationResults: OutreachMediumResult[] }
> {
  const { oystehr, task, charge, notify } = params;
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
  const chargeResult = await charge();

  if (chargeResult.success) {
    // ── Success path: send success notifications and complete ──
    const notificationResults = await notify(config.onSuccess, chargeResult);

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
    return { status: 'completed', attempt: currentAttempt, chargeResult, notificationResults };
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
      status: 'retry-scheduled',
      attempt: currentAttempt,
      nextRetryDate,
      chargeResult,
    };
  }

  // ── Final failure: no retries left, send failure notifications and mark failed ──
  const notificationResults = await notify(config.onFailure, chargeResult);

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
  return { status: 'failed', attempt: currentAttempt, chargeResult, notificationResults };
}

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

function extractChargeCardConfig(task: Task): ChargeCardConfig {
  const configInput = task.input?.find((i) => i.type?.text === 'charge-card-config');
  if (!configInput?.valueString) {
    throw new Error('charge-card-config not found in task input');
  }
  return JSON.parse(configInput.valueString) as ChargeCardConfig;
}

export async function payOpenStripeInvoice(
  stripe: Stripe,
  stripeInvoice: Stripe.Invoice,
  stripeCustomerId: string,
  stripeAccount: string | undefined
): Promise<ChargeResult> {
  if (stripeInvoice.status !== 'open') {
    return {
      success: false,
      error: `Stripe invoice ${stripeInvoice.id} is not open (status: ${stripeInvoice.status})`,
      stripeAccount,
    };
  }

  // Verify the customer has a default payment method
  const customer = await stripe.customers.retrieve(
    stripeCustomerId,
    { expand: ['invoice_settings.default_payment_method'] },
    { stripeAccount }
  );
  if (customer.deleted) {
    return { success: false, error: `Stripe customer ${stripeCustomerId} has been deleted`, stripeAccount };
  }
  if (!customer.invoice_settings?.default_payment_method) {
    return {
      success: false,
      error: `No default payment method on file for Stripe customer ${stripeCustomerId}`,
      stripeAccount,
    };
  }

  // Attempt to pay the invoice
  console.log(
    `Charging Stripe invoice ${stripeInvoice.id} (amount_due=${stripeInvoice.amount_due}) for customer ${stripeCustomerId}`
  );
  try {
    const paidInvoice = await stripe.invoices.pay(stripeInvoice.id, { stripeAccount });

    if (paidInvoice.status === 'paid') {
      console.log(`Successfully charged invoice ${stripeInvoice.id}`);
      return {
        success: true,
        transactionId: typeof paidInvoice.charge === 'string' ? paidInvoice.charge : paidInvoice.charge?.id,
        amountCents: stripeInvoice.amount_due,
        invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
        stripeAccount,
      };
    } else {
      return {
        success: false,
        error: `Invoice payment returned status: ${paidInvoice.status}`,
        amountCents: stripeInvoice.amount_due,
        invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
        stripeAccount,
      };
    }
  } catch (err: any) {
    console.error(`Stripe payment failed for invoice ${stripeInvoice.id}:`, err.message);
    return {
      success: false,
      error: err.message || 'Unknown Stripe error',
      amountCents: stripeInvoice.amount_due,
      invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
      stripeAccount,
    };
  }
}
