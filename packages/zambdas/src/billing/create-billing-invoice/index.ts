import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, Location, Organization, Practitioner, ProvenanceAgent, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
  buildBillingInvoice,
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getInvoiceNumber,
  getStripeInvoiceLink,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  invoiceStatusFromStripe,
  withHostedInvoiceUrl,
  withStripeInvoiceLink,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { fillInvoiceTemplate, parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import {
  PREPARE_BILLING_INVOICE_ZAMBDA_KEY,
  PrepareBillingInvoiceResponse,
  SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import { CreateBillingInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  FHIR_RESOURCE_NOT_FOUND,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { formatDateConfigurable } from 'utils/lib/utils/dateUtils';
import { getOrCreateInvoicingConfig } from '../../rcm/invoice-config/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { nextInvoiceNumber } from '../../shared/invoice-number';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, STRIPE_METADATA_KEYS, stripeEncounterMetadata } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { INVOICE_ISSUER_CLAIM_INCLUDES, resolveClaimInvoiceIssuer } from '../invoice-issuer';
import { getInvoiceableEncounterId } from '../invoices';
import { applyClaimStatusField, resolveClaimActor } from '../provenance';
import { copySourceId, createBillingClient, findById } from '../shared';
import { CreateBillingInvoiceParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-billing-invoice';

const CLAIM_ALREADY_INVOICED = 'This claim already has an invoice.';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

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
  const resources = (
    await oystehr.fhir.search<Claim | Location | Organization | Practitioner>({
      resourceType: 'Claim',
      params: [{ name: '_id', value: params.claimId }, ...INVOICE_ISSUER_CLAIM_INCLUDES],
    })
  ).unbundle();
  const claim = resources.find((resource): resource is Claim => resource.resourceType === 'Claim');
  if (!claim) throw FHIR_RESOURCE_NOT_FOUND('Claim');
  const encounterId = getInvoiceableEncounterId(claim);
  const { questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);
  const config = parseInvoiceConfigFromQR(questionnaireResponse);
  const issuer = resolveClaimInvoiceIssuer(claim, resources, config.invoiceIssuerSource);

  // Check EHR ownership and the Stripe customer before creating a billing invoice.
  const visit = chooseJson<PrepareBillingInvoiceResponse>(
    await oystehr.zambda.execute({ id: PREPARE_BILLING_INVOICE_ZAMBDA_KEY, encounterId })
  );

  let invoice = await findOrCreateDraft(oystehr, stripe, claim, params, issuer.organization);
  // Only the request that sends the invoice knows whether its SMS went out.
  let smsSent: boolean | undefined;
  if (invoice.status === 'draft') {
    // Number the saved draft so retries reuse its number.
    if (!getInvoiceNumber(invoice)) {
      invoice = await updateInvoice(oystehr, {
        ...invoice,
        identifier: [
          ...(invoice.identifier ?? []),
          { system: INVOICE_NUMBER_IDENTIFIER_SYSTEM, value: await nextInvoiceNumber(oystehr) },
        ],
      });
    }
    ({ invoice, smsSent } = await sendDraft(oystehr, stripe, invoice, { encounterId, visit, params }));
  }

  if (getClaimStatusValues(claim).patientArStatus === 'ready-to-invoice') {
    await applyClaimStatusField(oystehr, claim, 'patientArStatus', 'invoiced', agent);
  }

  return {
    invoiceId: invoice.id!,
    stripeInvoiceId: getStripeInvoiceLink(invoice)!.stripeInvoiceId,
    smsSent,
  };
}

const idempotencyKeyOf = (invoice: Invoice): string | undefined =>
  invoice.identifier?.find((identifier) => identifier.system === BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM)?.value;

async function findOrCreateDraft(
  oystehr: Oystehr,
  stripe: Stripe,
  claim: Claim,
  params: CreateBillingInvoiceParams,
  issuer: Reference
): Promise<Invoice> {
  const invoice = await createDraftUnlessClaimHasInvoice(oystehr, claim, params, issuer);
  if (idempotencyKeyOf(invoice) !== params.idempotencyKey) {
    // The invoice was started by another request.
    if (invoice.status !== 'draft') throw BILLING_INVOICE_CONFLICT_ERROR(CLAIM_ALREADY_INVOICED);
    if (await discardUnsentDraft(oystehr, stripe, invoice)) {
      const replacement = await createDraftUnlessClaimHasInvoice(oystehr, claim, params, issuer);
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
  params: CreateBillingInvoiceParams,
  issuer: Reference
): Promise<Invoice> {
  if (!claim.patient) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Claim has no patient');
  const draft = buildBillingInvoice({
    status: 'draft',
    date: DateTime.now().toUTC().toISO()!,
    dueDate: params.dueDate,
    issuer,
    recipient: claim.patient,
    subject: claim.patient,
    claims: [{ claimId: claim.id!, amountCents: params.amountCents }],
    facilityId: await getServiceFacilityId(oystehr, claim),
  });
  draft.identifier = [{ system: BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM, value: params.idempotencyKey }];
  return oystehr.fhir.create<Invoice>(draft, {
    ifNoneExist: [
      { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claim.id}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      { name: 'status', value: 'draft,issued,balanced' },
    ],
  });
}

// The claim points at its own copy of the service facility. The copy records which facility it came from.
async function getServiceFacilityId(oystehr: Oystehr, claim: Claim): Promise<string | undefined> {
  const copyId = getIdFromReference(claim.facility?.reference, 'Location');
  return copyId ? copySourceId(await findById<Location>(oystehr, 'Location', copyId)) : undefined;
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
): Promise<{ invoice: Invoice; smsSent?: boolean }> {
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
  if (stripeInvoice.status === 'open') {
    // Keyed by the FHIR invoice so overlapping or repeated attempts send one email. Stripe keeps the
    // first result for 24 hours and rejects a second send while the first is still running.
    stripeInvoice = await stripe.invoices.sendInvoice(stripeInvoice.id, undefined, {
      ...options,
      idempotencyKey: `billing-invoice-send-${invoice.id}`,
    });
  }
  if (stripeInvoice.status !== 'open' && stripeInvoice.status !== 'paid') {
    throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status}, expected open`);
  }

  // Save the status before SMS so retries do not resend either message.
  const hostedUrl = stripeInvoice.hosted_invoice_url;
  invoice = await updateInvoice(oystehr, {
    ...(hostedUrl ? withHostedInvoiceUrl(invoice, hostedUrl) : invoice),
    status: invoiceStatusFromStripe(stripeInvoice.status),
  });
  if (stripeInvoice.status === 'paid') return { invoice };

  try {
    const smsMessage = fillInvoiceTemplate(params.smsMessage, {
      ...placeholders,
      invoiceLink: stripeInvoice.hosted_invoice_url ?? undefined,
    });
    await oystehr.zambda.execute({ id: SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY, encounterId, message: smsMessage });
    return { invoice, smsSent: true };
  } catch (error) {
    console.warn('Invoice emailed but SMS request failed', { invoiceId: invoice.id, error });
    return { invoice, smsSent: false };
  }
}

// Versioned, so a request working on an invoice another request has replaced stops here.
const updateInvoice = (oystehr: Oystehr, invoice: Invoice): Promise<Invoice> =>
  oystehr.fhir.update<Invoice>(invoice, { optimisticLockingVersionId: invoice.meta?.versionId });
