import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getBillingInvoiceSmsAccepted,
  getStripeInvoiceLink,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_SMS_ACCEPTED_EXTENSION_URL,
  withStripeInvoiceLink,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { fillInvoiceTemplate } from 'utils/lib/helpers/rcm/invoice-config';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceResponse,
  SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import { CreateBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { CreateBillingInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  MISCONFIGURED_ENVIRONMENT_ERROR,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { formatDateConfigurable } from 'utils/lib/utils/dateUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, STRIPE_METADATA_KEYS, stripeEncounterMetadata } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getInvoiceableEncounterId } from '../invoices';
import { applyClaimStatusField, resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type CreateBillingInvoiceParams = ValidatedZambdaInput<typeof CreateBillingInvoiceInputSchema>;

const ZAMBDA_NAME = 'create-billing-invoice';

const IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('billing-invoice-idempotency-key');
const CLAIM_ALREADY_INVOICED = 'This claim already has an invoice.';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(CreateBillingInvoiceInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, getStripeClient(params.secrets), params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  stripe: Stripe,
  params: CreateBillingInvoiceParams,
  agent: ProvenanceAgent
): Promise<CreateBillingInvoiceResponse> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const encounterId = getInvoiceableEncounterId(claim);

  // Runs before the draft exists, so a patient without a usable Stripe customer leaves nothing behind.
  const visit = chooseJson<PrepareBillingInvoiceResponse>(
    await oystehr.zambda.execute({ id: PREPARE_BILLING_INVOICE_ZAMBDA_KEY, encounterId })
  );

  let invoice = await findOrCreateDraft(oystehr, stripe, claim, params);
  if (invoice.status === 'draft') {
    invoice = await sendDraft(oystehr, stripe, invoice, { encounterId, visit, params });
  }

  if (getClaimStatusValues(claim).patientArStatus === 'ready-to-invoice') {
    await applyClaimStatusField(oystehr, claim, 'patientArStatus', 'invoiced', agent);
  }

  return {
    invoiceId: invoice.id!,
    stripeInvoiceId: getStripeInvoiceLink(invoice)!.stripeInvoiceId,
    smsSent: getBillingInvoiceSmsAccepted(invoice),
  };
}

const idempotencyKeyOf = (invoice: Invoice): string | undefined =>
  invoice.identifier?.find((identifier) => identifier.system === IDEMPOTENCY_KEY_SYSTEM)?.value;

async function findOrCreateDraft(
  oystehr: Oystehr,
  stripe: Stripe,
  claim: Claim,
  params: CreateBillingInvoiceParams
): Promise<Invoice> {
  const invoice = await createDraftUnlessClaimHasInvoice(oystehr, claim, params);
  if (idempotencyKeyOf(invoice) !== params.idempotencyKey) {
    // The invoice was started by another request.
    if (invoice.status !== 'draft') throw BILLING_INVOICE_CONFLICT_ERROR(CLAIM_ALREADY_INVOICED);
    if (await discardUnsentDraft(oystehr, stripe, invoice)) {
      const replacement = await createDraftUnlessClaimHasInvoice(oystehr, claim, params);
      if (idempotencyKeyOf(replacement) !== params.idempotencyKey) {
        throw BILLING_INVOICE_CONFLICT_ERROR(CLAIM_ALREADY_INVOICED);
      }
      return replacement;
    }
    // Stripe already finalized it, so it can only be finished as it is.
  }

  // A resumed invoice keeps its own values, so they must match what this request asked for.
  const amountCents = getBillingInvoiceClaims(invoice)[0]?.amountCents;
  const dueDate = getBillingInvoiceDueDate(invoice);
  if (amountCents !== params.amountCents || dueDate !== params.dueDate) {
    throw BILLING_INVOICE_CONFLICT_ERROR(
      `This claim already has an invoice for ${formatCurrencyFromCents(amountCents)} due ` +
        `${formatDateConfigurable({ isoDate: dueDate })}. Retry with that amount and due date.`
    );
  }
  return invoice;
}

// Returns the claim's invoice when it has one that isn't cancelled or entered in error.
async function createDraftUnlessClaimHasInvoice(
  oystehr: Oystehr,
  claim: Claim,
  params: CreateBillingInvoiceParams
): Promise<Invoice> {
  if (!claim.patient) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Claim has no patient');
  const draft: Invoice = {
    ...buildBillingInvoice({
      status: 'draft',
      date: DateTime.now().toUTC().toISO()!,
      dueDate: params.dueDate,
      recipient: claim.patient,
      subject: claim.patient,
      claims: [{ claimId: claim.id!, amountCents: params.amountCents }],
    }),
    identifier: [{ system: IDEMPOTENCY_KEY_SYSTEM, value: params.idempotencyKey }],
  };
  return oystehr.fhir.create<Invoice>(draft, {
    ifNoneExist: [
      { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claim.id}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      { name: 'status', value: 'draft,issued,balanced' },
    ],
  });
}

// A draft whose Stripe invoice was never finalized never reached the patient, so it can be replaced.
async function discardUnsentDraft(oystehr: Oystehr, stripe: Stripe, invoice: Invoice): Promise<boolean> {
  const link = getStripeInvoiceLink(invoice);
  if (link) {
    const options = { stripeAccount: link.stripeAccount };
    const stripeInvoice = await stripe.invoices.retrieve(link.stripeInvoiceId, undefined, options);
    if (stripeInvoice.status !== 'draft') return false;
    await stripe.invoices.del(link.stripeInvoiceId, undefined, options);
  }
  await updateInvoice(oystehr, { ...invoice, status: 'entered-in-error' });
  return true;
}

// Every step checks what an earlier attempt already did, so a retry picks up where it stopped.
async function sendDraft(
  oystehr: Oystehr,
  stripe: Stripe,
  draft: Invoice,
  context: { encounterId: string; visit: PrepareBillingInvoiceResponse; params: CreateBillingInvoiceParams }
): Promise<Invoice> {
  const { encounterId, visit, params } = context;
  const amountCents = getBillingInvoiceClaims(draft)[0].amountCents;
  const dueDate = getBillingInvoiceDueDate(draft)!;
  const placeholders = { ...visit.placeholders, amountCents, dueDate };
  const memo = fillInvoiceTemplate(params.memo, placeholders);

  let invoice = draft;
  let stripeInvoice: Stripe.Invoice;
  const link = getStripeInvoiceLink(invoice);
  const options = { stripeAccount: link ? link.stripeAccount : visit.stripeAccount };
  if (link) {
    stripeInvoice = await stripe.invoices.retrieve(link.stripeInvoiceId, undefined, options);
  } else {
    stripeInvoice = await stripe.invoices.create(
      {
        customer: visit.stripeCustomerId,
        collection_method: 'send_invoice',
        description: memo,
        metadata: {
          ...stripeEncounterMetadata({ encounterId, patientId: visit.patientId }),
          [STRIPE_METADATA_KEYS.invoiceId]: invoice.id!,
        },
        currency: 'USD',
        due_date: DateTime.fromISO(dueDate, { zone: visit.timezone }).toUnixInteger(),
        pending_invoice_items_behavior: 'exclude',
        auto_advance: false,
      },
      // Keyed by the FHIR invoice so a retry gets the same Stripe invoice back.
      { ...options, idempotencyKey: `billing-invoice-${invoice.id}` }
    );
    invoice = await updateInvoice(
      oystehr,
      withStripeInvoiceLink(invoice, { stripeInvoiceId: stripeInvoice.id, stripeAccount: options.stripeAccount })
    );
  }

  if (stripeInvoice.status === 'draft') {
    if (stripeInvoice.lines.data.length === 0) {
      await stripe.invoiceItems.create(
        {
          customer: visit.stripeCustomerId,
          amount: amountCents,
          currency: 'usd',
          description: memo,
          invoice: stripeInvoice.id,
        },
        { ...options, idempotencyKey: `billing-invoice-item-${invoice.id}` }
      );
    }
    stripeInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id, undefined, options);
  }
  if (stripeInvoice.status !== 'open') {
    throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status}, expected open`);
  }
  stripeInvoice = await stripe.invoices.sendInvoice(stripeInvoice.id, undefined, options);

  let smsSent = false;
  try {
    const smsMessage = fillInvoiceTemplate(params.smsMessage, {
      ...placeholders,
      invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
    });
    await oystehr.zambda.execute({ id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY, encounterId, message: smsMessage });
    smsSent = true;
  } catch (error) {
    console.warn('Invoice emailed but SMS request failed', { invoiceId: invoice.id, error });
  }

  // Save the SMS result with the issued status so retries return it without resending.
  return updateInvoice(oystehr, {
    ...invoice,
    status: 'issued',
    extension: [
      ...(invoice.extension ?? []).filter((extension) => extension.url !== INVOICE_SMS_ACCEPTED_EXTENSION_URL),
      { url: INVOICE_SMS_ACCEPTED_EXTENSION_URL, valueBoolean: smsSent },
    ],
  });
}

// Versioned, so a request working on an invoice another request has replaced stops here.
const updateInvoice = (oystehr: Oystehr, invoice: Invoice): Promise<Invoice> =>
  oystehr.fhir.update<Invoice>(invoice, { optimisticLockingVersionId: invoice.meta?.versionId });
