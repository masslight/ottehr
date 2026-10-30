import { input } from '@inquirer/prompts';
import Oystehr from '@oystehr/sdk';
import { Claim, Invoice, QuestionnaireResponse, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getStripeInvoiceLink,
  STRIPE_INVOICE_ID_SYSTEM,
  withHostedInvoiceUrl,
  withStripeInvoiceLink,
} from 'utils/lib/fhir/billing-invoice';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import {
  getInvoiceTaskClaimId,
  getInvoiceTaskOutputs,
  invoiceTaskSourceSearchParam,
  parseInvoiceTaskInput,
} from 'utils/lib/helpers/tasks/invoices-tasks';
import { Secrets } from 'utils/lib/secrets';
import { getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { getServiceFacilityId } from '../billing/invoices';
import { applyClaimStatusField, resolveClaimActor } from '../billing/provenance';
import { listStripeAccounts } from '../billing/reports/shared';
import { createBillingClient, findById } from '../billing/shared';
import { getOrCreateInvoicingConfig } from '../rcm/invoice-config/helpers';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient, RCM_TAG_SYSTEM } from '../shared/helpers';
import { isOttehrBillingInvoicingInBillingApp } from '../shared/invoice-tasks';
import { getStripeClient } from '../shared/stripeIntegration';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-off move of a project's invoicing from the EHR to the billing app.
 *
 * Copies the EHR invoicing config (due days, SMS template and invoice memo) into the billing
 * workspace, so the billing app keeps each practice's templates instead of starting from the defaults.
 * The EHR copy is not changed because EHR invoicing keeps using it until it is removed.
 *
 * If the billing config was already saved from the billing app, the preview says so and applying
 * replaces it with the EHR values.
 *
 * Once INVOICING_IN_BILLING_APP is on in config/.env/<env>.json, it also hands over the EHR invoice tasks
 * made from billing claims, so run it after turning the secret on. Tasks that were never sent are cancelled,
 * and the billing app invoices those visits. For sent ones the claim moves from Ready to invoice to Invoiced, and
 * the task stays so the billing app won't invoice the visit again. Candid invoice tasks are left alone.
 *
 * Sent invoices that are still open in Stripe get a copy in the billing app, so they show on the Invoices
 * screen and the billing Stripe webhook marks them paid or void. Paid and void ones need nothing more, so
 * they stay only in Stripe and the EHR.
 *
 * Preview by default. Pass `--apply` to make the changes:
 *   npm run migrate-invoicing-to-billing -- <env>            # preview only
 *   npm run migrate-invoicing-to-billing -- <env> --apply    # apply
 */
const APPLY = process.argv.includes('--apply');

async function findConfigResponse(oystehr: Oystehr): Promise<QuestionnaireResponse | undefined> {
  const bundle = await oystehr.fhir.search<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|invoice-config` }],
  });
  return bundle.unbundle()[0];
}

function describeConfig(qr: QuestionnaireResponse): string {
  const config = parseInvoiceConfigFromQR(qr);
  return [
    `  Due days: ${config.dueDaysFromGeneration}`,
    `  SMS template: ${JSON.stringify(config.defaultSmsTemplate)}`,
    `  Invoice memo: ${JSON.stringify(config.defaultInvoiceMemo)}`,
  ].join('\n');
}

interface TaskHandover {
  claimsToMove: Claim[];
  tasksToCancel: Task[];
  invoiceCopies: Invoice[];
}

async function findTaskHandover(
  clinicalOystehr: Oystehr,
  billingOystehr: Oystehr,
  stripe: Stripe
): Promise<TaskHandover> {
  const coding = RcmTaskCodings.sendInvoiceToPatient.coding?.[0];
  const tasks = await getAllFhirSearchPages<Task>(
    {
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${coding?.system}|${coding?.code}` },
        invoiceTaskSourceSearchParam('ottehr-billing')!,
        { name: 'status:not', value: 'cancelled' },
      ],
    },
    clinicalOystehr
  );

  const handover: TaskHandover = { claimsToMove: [], tasksToCancel: [], invoiceCopies: [] };
  const sentTasks = new Map<string, Task>();
  for (const task of tasks) {
    const claimId = getInvoiceTaskClaimId(task);
    const stripeInvoiceId = getInvoiceTaskOutputs(task).invoiceId;
    if (stripeInvoiceId) {
      sentTasks.set(stripeInvoiceId, task);
      if (!claimId) continue;
      const [claim] = (
        await billingOystehr.fhir.search<Claim>({ resourceType: 'Claim', params: [{ name: '_id', value: claimId }] })
      ).unbundle();
      if (claim && getClaimStatusValues(claim).patientArStatus === 'ready-to-invoice') {
        handover.claimsToMove.push(claim);
      }
    } else if (task.status === 'ready' || task.status === 'failed') {
      handover.tasksToCancel.push(task);
    } else {
      console.log(
        `Task/${task.id} is ${task.status}, so it is left as it is. Run this again once it is sent or fails.`
      );
    }
  }

  // Listing only open invoices keeps this to a few Stripe calls however many were sent.
  for (const stripeAccount of await listStripeAccounts(billingOystehr, clinicalOystehr, stripe)) {
    for await (const stripeInvoice of stripe.invoices.list({ status: 'open', limit: 100 }, { stripeAccount })) {
      const task = sentTasks.get(stripeInvoice.id);
      const copy = task && (await buildInvoiceCopy(billingOystehr, task, stripeInvoice, stripeAccount));
      if (copy) handover.invoiceCopies.push(copy);
    }
  }
  return handover;
}

async function buildInvoiceCopy(
  billingOystehr: Oystehr,
  task: Task,
  stripeInvoice: Stripe.Invoice,
  stripeAccount: string | undefined
): Promise<Invoice | undefined> {
  const [copied] = (
    await billingOystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [{ name: 'identifier', value: `${STRIPE_INVOICE_ID_SYSTEM}|${stripeInvoice.id}` }],
    })
  ).unbundle();
  if (copied) return undefined;

  const claimId = getInvoiceTaskClaimId(task);
  const claim = claimId ? await findById<Claim>(billingOystehr, 'Claim', claimId) : undefined;
  const { dueDate } = parseInvoiceTaskInput(task);
  if (!claim || !dueDate) {
    console.log(`Task/${task.id} has no billing claim or due date, so its open invoice is not copied.`);
    return undefined;
  }

  const invoice = withStripeInvoiceLink(
    buildBillingInvoice({
      status: 'issued',
      date: DateTime.fromSeconds(stripeInvoice.status_transitions.finalized_at ?? stripeInvoice.created)
        .toUTC()
        .toISO()!,
      dueDate,
      recipient: claim.patient,
      subject: claim.patient,
      claims: [{ claimId: claim.id!, amountCents: stripeInvoice.total }],
      facilityId: await getServiceFacilityId(billingOystehr, claim),
    }),
    { stripeInvoiceId: stripeInvoice.id, stripeAccount }
  );
  const hostedUrl = stripeInvoice.hosted_invoice_url;
  return hostedUrl ? withHostedInvoiceUrl(invoice, hostedUrl) : invoice;
}

async function migrate(config: Secrets & { env: string }): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');

  console.log(`\n=== migrate-invoicing-to-billing (${APPLY ? 'APPLY' : 'PREVIEW'}) for ${config.env} ===`);
  console.log(`Project ${config.PROJECT_ID}, ${config.EHR_ORGANIZATION_NAME_SHORT}`);

  const clinicalOystehr = createClinicalOystehrClient(token, config);
  const ehrConfig = await findConfigResponse(clinicalOystehr);
  if (!ehrConfig) {
    // The EHR creates its config before its first invoice task, so there are no tasks either.
    console.log('\nNo EHR invoicing config found, so the EHR never invoiced. Nothing to move.');
    return;
  }
  console.log(`\nEHR config (QuestionnaireResponse/${ehrConfig.id})\n${describeConfig(ehrConfig)}`);

  const billingOystehr = createBillingClient(token, config);
  const billingConfig = await findConfigResponse(billingOystehr);
  if (!billingConfig) {
    console.log('\nBilling config does not exist yet. It will be created with the EHR values.');
  } else {
    console.log(`\nBilling config (QuestionnaireResponse/${billingConfig.id})\n${describeConfig(billingConfig)}`);
    // Only a save sets authored, so a billing config without it still holds the defaults.
    if (billingConfig.authored) {
      console.log(`\nIt was saved from the billing app on ${billingConfig.authored}. Applying replaces it.`);
    }
  }

  // Before the switch, cancelling would take tasks away from EHR invoicing.
  let handover: TaskHandover | undefined;
  if (isOttehrBillingInvoicingInBillingApp(config)) {
    handover = await findTaskHandover(clinicalOystehr, billingOystehr, getStripeClient(config));
    console.log(
      `\nEHR invoice tasks: ${handover.tasksToCancel.length} unsent to cancel, ` +
        `${handover.claimsToMove.length} claims of sent ones to move to Invoiced, ` +
        `${handover.invoiceCopies.length} open invoices to copy into the billing app.`
    );
  } else {
    console.log('\nInvoicing is still in the EHR, so its invoice tasks are left alone.');
  }

  if (!APPLY) {
    console.log('\nPreview only. Re-run with `--apply` to make these changes.');
    return;
  }

  const answer = await input({ message: `Apply these changes for ${config.env}? Type "yes" to confirm:` });
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted, nothing changed.');
    return;
  }

  const { questionnaire, questionnaireResponse } = await getOrCreateInvoicingConfig(billingOystehr);
  const copy = await billingOystehr.fhir.update<QuestionnaireResponse>({
    ...questionnaireResponse,
    questionnaire: `Questionnaire/${questionnaire.id}`,
    status: 'completed',
    authored: new Date().toISOString(),
    item: ehrConfig.item,
  });
  console.log(`Billing QuestionnaireResponse/${copy.id} now has the EHR values.`);

  if (handover) {
    const agent = await resolveClaimActor('system', billingOystehr, undefined, config);
    for (const claim of handover.claimsToMove) {
      await applyClaimStatusField(billingOystehr, claim, 'patientArStatus', 'invoiced', agent);
      console.log(`Claim/${claim.id} moved to Invoiced.`);
    }
    for (const task of handover.tasksToCancel) {
      await clinicalOystehr.fhir.patch<Task>({
        resourceType: 'Task',
        id: task.id!,
        operations: [{ op: 'replace', path: '/status', value: 'cancelled' }],
      });
      console.log(`Task/${task.id} cancelled.`);
    }
    for (const copy of handover.invoiceCopies) {
      const created = await billingOystehr.fhir.create<Invoice>(copy);
      console.log(`Invoice/${created.id} copies open Stripe invoice ${getStripeInvoiceLink(copy)?.stripeInvoiceId}.`);
    }
  }
  console.log('Done.');
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
