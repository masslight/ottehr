import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Claim,
  FhirResource,
  Identifier,
  Invoice,
  Money,
  PaymentNotice,
  PaymentReconciliation,
  Reference,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  invoiceStatusFromStripe,
  isInvoiceUncollectible,
  STRIPE_INVOICE_ID_SYSTEM,
  withHostedInvoiceUrl,
  withInvoiceUncollectible,
} from 'utils/lib/fhir/billing-invoice';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { parsePaymentRefundsFromNotice, staleReservationIds } from 'utils/lib/fhir/paymentRefunds';
import { getContainedReconciliation, getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { EHR_PAYMENT_RESERVATION_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { shouldUseOttehrBilling } from '../../shared/candid';
import { isFhirNotFoundError } from '../../shared/errors';
import { wrapHandler } from '../../shared/sentry';
import {
  applyRefundsToPaymentNoticeWithRetry,
  ehrPaymentIdFromStripeMetadata,
  ehrPaymentNoticeIdFromStripeMetadata,
  encounterIdFromStripeMetadata,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
  stripeRefundToDTO,
} from '../../shared/stripeIntegration';
import { StripeWebhookParams } from '../../shared/stripeWebhook';
import { ZambdaInput } from '../../shared/types/common';
import { cancelPendingInvoiceOutreach } from '../invoice-outreach';
import { unionIdentifiers } from '../patient-payments';
import {
  billingProviderRefForStripeAccount,
  claimRequestFor,
  createPaymentNotice,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM,
  ehrPaymentDate,
  findBillingClaimForEncounter,
  findPaymentNotice,
  findPaymentNoticeByAnyIdentifier,
  isActivatedEhrPaymentNotice,
  isPendingEhrPaymentNotice,
  paymentActor,
  paymentNoticeHistoryRequest,
  reconcilePaymentNoticesForClaim,
  recordPaymentNoticeChange,
  stampedStripeAccount,
  stripeAccountExtension,
  withActivatedEhrPaymentId,
  withStripeAccountExtension,
} from '../payments';
import { humanClaimActor, resolveClaimActor } from '../provenance';
import { createBillingClient } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'billing-stripe-webhook';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { event, stripeAccount } = params;
  console.log('Verified Stripe event:', event.id, event.type, 'connected account:', stripeAccount ?? 'none');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

// Patient payments live in billing whatever BILLING_INTEGRATION says, so their Stripe-owned state
// and refund stamps are always kept current. Only Ottehr billing records Stripe activity the EHR did
// not: a charge with no notice yet, the negative AR offset of a refund, an invoice paid out of band.
export const performEffect = async (oystehr: Oystehr, params: StripeWebhookParams): Promise<void> => {
  const { event, secrets, stripeAccount = event.account } = params;
  const recordsAr = shouldUseOttehrBilling(secrets);
  switch (event.type) {
    case 'charge.succeeded':
    case 'charge.updated': {
      const charge = event.data.object as Stripe.Charge;
      console.log(`Charge event for ${charge.id}, invoice: ${chargeInvoiceId(charge) ?? 'none'}`);
      await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, stripeAccount, secrets, recordsAr);
      break;
    }
    case 'charge.refunded': {
      // refunds are recorded via the refund.* events
      const charge = event.data.object as Stripe.Charge;
      console.log(`Ignoring charge.refunded for ${charge.id}`);
      break;
    }
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const refund = event.data.object as Stripe.Refund;
      console.log(`Refund event for ${refund.id}, charge: ${refund.charge}, status: ${refund.status}`);
      await upsertPaymentNoticeForRefund(oystehr, refund, stripeAccount, secrets, recordsAr);
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice paid event for ${invoice.id}, charge: ${invoice.charge ?? 'none'}`);
      await updateBillingInvoiceStatus(oystehr, invoice, 'paid');
      if (!recordsAr) {
        console.log(`BILLING_INTEGRATION does not include ottehr; not recording invoice ${invoice.id}`);
        break;
      }
      await upsertPaymentNoticeForChargelessInvoice(oystehr, invoice, stripeAccount, secrets);
      break;
    }
    case 'invoice.voided': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice voided event for ${invoice.id}`);
      await updateBillingInvoiceStatus(oystehr, invoice, 'void');
      break;
    }
    case 'invoice.marked_uncollectible': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice marked uncollectible event for ${invoice.id}`);
      await updateBillingInvoiceStatus(oystehr, invoice, 'uncollectible');
      break;
    }
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }
};

const buildBillingPaymentNotice = (params: {
  claim: Claim | undefined;
  encounterId: string;
  billingProviderRef: Reference;
  stripeAccount: string | undefined;
  createdISO: string;
  amount: Money;
  identifiers: Identifier[];
  paymentMethod: string;
  disposition: string;
  outcome: PaymentReconciliation['outcome'];
  cancelled?: boolean;
}): PaymentNotice => {
  const {
    claim,
    encounterId,
    billingProviderRef,
    stripeAccount,
    createdISO,
    amount,
    identifiers,
    paymentMethod,
    disposition,
    outcome,
    cancelled,
  } = params;
  const status = cancelled ? 'cancelled' : 'active';

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status,
    created: createdISO,
    disposition,
    outcome,
    paymentDate: createdISO.slice(0, 10),
    paymentAmount: amount,
  };

  return {
    resourceType: 'PaymentNotice',
    status,
    request: claimRequestFor(claim, encounterId),
    created: createdISO,
    amount,
    identifier: identifiers,
    extension: [
      {
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: paymentMethod,
      },
      stripeAccountExtension(stripeAccount),
    ],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: billingProviderRef,
    recipient: billingProviderRef,
  };
};

const getPaymentNoticeIfExists = async (oystehr: Oystehr, id: string): Promise<PaymentNotice | undefined> => {
  try {
    return await oystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id });
  } catch (error) {
    if (isFhirNotFoundError(error) || (error as { code?: unknown })?.code === 410) return undefined;
    throw error;
  }
};

const chargeInvoiceId = (charge: Stripe.Charge): string | undefined =>
  (typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id) || undefined;

const resolveEncounterIdForCharge = async (
  charge: Stripe.Charge,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<string | undefined> => {
  const fromCharge = encounterIdFromStripeMetadata(charge.metadata);
  if (fromCharge) return fromCharge;

  if (!charge.invoice) return undefined;
  if (typeof charge.invoice !== 'string') return encounterIdFromStripeMetadata(charge.invoice.metadata);

  try {
    const invoice = await getStripeClient(secrets).invoices.retrieve(charge.invoice, undefined, { stripeAccount });
    return encounterIdFromStripeMetadata(invoice.metadata);
  } catch (error) {
    // a deleted invoice is terminal, anything else is worth the redelivery a throw earns us
    if ((error as Stripe.errors.StripeError)?.code === 'resource_missing') {
      console.warn(`Stripe invoice ${charge.invoice} for charge ${charge.id} no longer exists; skipping`);
      return undefined;
    }
    throw error;
  }
};

const upsertPaymentNoticeOnBillingClaimForCharge = async (
  oystehr: Oystehr,
  charge: Stripe.Charge,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets'],
  createIfMissing: boolean
): Promise<void> => {
  const encounterId = await resolveEncounterIdForCharge(charge, stripeAccount, secrets);
  const invoiceId = chargeInvoiceId(charge);
  if (!encounterId) {
    const source = invoiceId ? `charge ${charge.id} nor its invoice ${invoiceId}` : `charge ${charge.id}`;
    console.warn(`Neither ${source} has encounter metadata; skipping PaymentNotice upsert`);
    return;
  }

  const ehrPaymentId = ehrPaymentIdFromStripeMetadata(charge.metadata);
  // The charge names the reservation that won it: requests reserving the payment at the same moment can
  // each store one, and only the winner's is the payment, so it is read by id rather than searched for.
  const reservationId = ehrPaymentNoticeIdFromStripeMetadata(charge.metadata);
  const found = reservationId
    ? await getPaymentNoticeIfExists(oystehr, reservationId)
    : await findPaymentNoticeByAnyIdentifier(oystehr, [
        { system: STRIPE_PAYMENT_ID_SYSTEM, value: charge.id },
        ...(ehrPaymentId
          ? [
              { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId },
              { system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId },
            ]
          : []),
      ]);
  if (!found && ehrPaymentId) {
    throw EHR_PAYMENT_RESERVATION_NOT_FOUND_ERROR(charge.id, ehrPaymentId);
  }
  // the reservation the charge names is its record unless activated already, also if a request whose
  // charge failed cancelled it meanwhile
  const ehrReservation = ehrReservationOf({ reservationId, ehrPaymentId });
  if (found && ehrReservation.isUnactivated(found) && charge.status !== 'succeeded') {
    console.log(`Charge ${charge.id} is ${charge.status}; leaving the EHR's reservation PaymentNotice/${found.id}`);
    return;
  }

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const billingProviderRef = await billingProviderRefForStripeAccount(oystehr, stripeAccount, secrets);

  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : undefined;
  const created = new Date(charge.created * 1000).toISOString();

  const paymentAmount: Money = {
    value: (charge.amount ?? 0) / 100,
    currency: (charge.currency ?? 'usd').toUpperCase(),
  };

  const desiredNotice = buildBillingPaymentNotice({
    claim,
    encounterId,
    billingProviderRef,
    stripeAccount,
    createdISO: created,
    amount: paymentAmount,
    identifiers: [
      {
        system: STRIPE_PAYMENT_ID_SYSTEM,
        value: charge.id,
      },
      ...(paymentIntentId
        ? [
            {
              system: STRIPE_PAYMENT_ID_SYSTEM,
              value: paymentIntentId,
            },
          ]
        : []),
    ],
    paymentMethod: charge.payment_method_details?.type ?? 'card',
    disposition: `Stripe charge ${charge.id} ${charge.status ?? ''}${invoiceId ? ` for invoice ${invoiceId}` : ''}`
      .replace(/\s+/g, ' ')
      .trim(),
    outcome: charge.paid ? 'complete' : 'partial',
  });

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, charge.id, claim, encounterId, createIfMissing, {
    knownNotice: found ?? null,
    ehrReservation,
  });
};

interface EhrReservation {
  // a reservation of the EHR's not activated yet, which the charge records as the payment
  isUnactivated: (notice: PaymentNotice) => boolean;
  ehrPaymentId: string | undefined;
}

// The charge names its reservation; a charge from before it did is matched by the reservation identifier.
const ehrReservationOf = ({
  reservationId,
  ehrPaymentId,
}: {
  reservationId: string | undefined;
  ehrPaymentId: string | undefined;
}): EhrReservation => ({
  isUnactivated: (notice) =>
    reservationId
      ? notice.id === reservationId && !isActivatedEhrPaymentNotice(notice)
      : isPendingEhrPaymentNotice(notice),
  ehrPaymentId,
});

// The EHR's reservation of a charge that went through, recorded as the payment: what Stripe owns is
// refreshed as on any notice, and it gains the EHR payment id readers search by. The payment is dated
// by the charge, as the EHR dates the payments it activates: the reservation may be from well before
// (reused by a replay, or reserved just before midnight), and reports place payments by these dates.
const activateEhrReservation = (
  pending: PaymentNotice,
  desiredNotice: PaymentNotice,
  ehrPaymentId: string | undefined
): PaymentNotice => {
  const refreshed = mergeStripeOwnedFields(pending, desiredNotice);
  const chargedAt = desiredNotice.created ? DateTime.fromISO(desiredNotice.created) : undefined;
  const dated =
    chargedAt?.isValid && desiredNotice.created
      ? { created: desiredNotice.created, paymentDate: ehrPaymentDate(chargedAt) }
      : undefined;
  return {
    ...refreshed,
    ...dated,
    identifier: withActivatedEhrPaymentId(refreshed.identifier, ehrPaymentId),
    contained: dated
      ? refreshed.contained?.map((resource) =>
          resource.resourceType === 'PaymentReconciliation' ? { ...resource, ...dated } : resource
        )
      : refreshed.contained,
  };
};

// The claim link is the stored one: only reconcile adds it, so the history recorded before it comes along.
const mergeStripeOwnedFields = (stored: PaymentNotice, desiredNotice: PaymentNotice): PaymentNotice => {
  const storedReconciliation = getContainedReconciliation(stored);
  const desiredReconciliation = getContainedReconciliation(desiredNotice);
  return {
    ...stored,
    status: desiredNotice.status,
    amount: desiredNotice.amount,
    request: { ...desiredNotice.request, reference: stored.request?.reference },
    // the organization behind the Stripe account the money landed in, whichever writer stored first
    payee: desiredNotice.payee,
    recipient: desiredNotice.recipient,
    // and the account itself, which notices stored before it was stamped gain here
    extension: withStripeAccountExtension(stored.extension, stampedStripeAccount(desiredNotice)?.stripeAccount),
    identifier: unionIdentifiers(stored.identifier, desiredNotice.identifier),
    contained:
      storedReconciliation && desiredReconciliation
        ? stored.contained?.map((resource) =>
            resource === storedReconciliation
              ? {
                  ...storedReconciliation,
                  status: desiredReconciliation.status,
                  outcome: desiredReconciliation.outcome,
                  disposition: desiredReconciliation.disposition,
                  paymentAmount: desiredReconciliation.paymentAmount,
                }
              : resource
          )
        : desiredNotice.contained,
  };
};

const persistPaymentNoticeUpsert = async (
  oystehr: Oystehr,
  desiredNotice: PaymentNotice,
  dedupStripeId: string,
  claim: Claim | undefined,
  encounterId: string,
  // false refreshes a notice that already exists and writes nothing otherwise
  createIfMissing: boolean,
  options: {
    refundedByReference?: string;
    // the notice the caller already looked up (null: looked up and found none), saving a second search
    knownNotice?: PaymentNotice | null;
    // for a charge: the EHR reservation it records, when the notice is one
    ehrReservation?: EhrReservation;
  } = {}
): Promise<void> => {
  const { refundedByReference, knownNotice } = options;
  const ehrReservation =
    options.ehrReservation ?? ehrReservationOf({ reservationId: undefined, ehrPaymentId: undefined });
  const dedupIdentifier = {
    system: STRIPE_PAYMENT_ID_SYSTEM,
    value: dedupStripeId,
  };
  const found =
    knownNotice === undefined ? await findPaymentNotice(oystehr, dedupIdentifier) : knownNotice ?? undefined;
  if (!found && !createIfMissing) {
    console.log(`No billing PaymentNotice records ${dedupStripeId}; nothing to refresh`);
    return;
  }
  const agent = await paymentActor(
    oystehr,
    refundedByReference
      ? {
          reference: refundedByReference,
        }
      : undefined,
    null
  );
  const stored = found
    ? {
        notice: found,
        created: false,
      }
    : await createPaymentNotice({
        oystehr,
        notice: desiredNotice,
        dedupIdentifier,
        agent,
      });
  // Refresh what Stripe owns but keep the rest: the notice may have been written by
  // post-billing-patient-payment (submitter, EHR identifier) and carry refund stamps. A notice a
  // concurrent delivery stored after the lookup is refreshed like one the lookup found; the refresh
  // is locked to the version it read, so a write since then is re-read and re-merged.
  const notice = stored.created
    ? stored.notice
    : await withVersionConflictRetries(async (attempt) => {
        const existing =
          attempt === 1
            ? stored.notice
            : await oystehr.fhir.get<PaymentNotice>({
                resourceType: 'PaymentNotice',
                id: stored.notice.id!,
              });
        // the EHR may not have activated its reservation: the charge went through, so it is recorded
        // here as the payment's creation, by whoever took it
        const activating = ehrReservation.isUnactivated(existing);
        const refreshed = activating
          ? activateEhrReservation(existing, desiredNotice, ehrReservation.ehrPaymentId)
          : mergeStripeOwnedFields(existing, desiredNotice);
        const submitter = activating ? getPaymentNoticeSubmitterRef(existing) : undefined;
        const history = paymentNoticeHistoryRequest({
          targetReference: `PaymentNotice/${existing.id}`,
          before: activating ? undefined : existing,
          after: refreshed,
          agent: submitter ? humanClaimActor(submitter) : agent,
        });
        await oystehr.fhir.transaction<FhirResource>({
          requests: [
            {
              method: 'PUT',
              url: `/PaymentNotice/${existing.id}`,
              resource: refreshed,
              ifMatch: makeOptimisticLockIfMatchHeader(existing),
            },
            ...(history ? [history] : []),
          ],
        });
        return refreshed;
      });

  if (!notice.request?.reference) {
    // the claim may have appeared while the notice was being stored
    const claimToLink = claim ?? (await findBillingClaimForEncounter(oystehr, encounterId));
    if (claimToLink) {
      await reconcilePaymentNoticesForClaim(oystehr, claimToLink);
    }
  }
};

const upsertPaymentNoticeForRefund = async (
  oystehr: Oystehr,
  refund: Stripe.Refund,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets'],
  recordsAr: boolean
): Promise<void> => {
  const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id;
  if (!chargeId) {
    console.warn(`Refund ${refund.id} has no charge; skipping PaymentNotice upsert`);
    return;
  }
  // refunds carry no metadata, the charge (or the invoice behind it) has the encounter id
  const charge = await getStripeClient(secrets).charges.retrieve(chargeId, { expand: ['invoice'] }, { stripeAccount });

  const encounterId = await resolveEncounterIdForCharge(charge, stripeAccount, secrets);
  if (!encounterId) {
    console.warn(`Charge ${charge.id} for refund ${refund.id} has no encounter metadata; skipping`);
    return;
  }

  // covers refunds whose charge event was never delivered
  await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, stripeAccount, secrets, recordsAr);

  if (!recordsAr) {
    // the payment's refund history is billing's either way; the AR offset is Ottehr billing's alone
    await markBillingNoticesForRefundedCharge(oystehr, charge, stripeAccount, secrets);
    return;
  }

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const billingProviderRef = await billingProviderRefForStripeAccount(oystehr, stripeAccount, secrets);
  const created = new Date(refund.created * 1000).toISOString();
  const failed = refund.status === 'failed' || refund.status === 'canceled';

  // negative so patient AR is a plain sum over a claim's notices
  const refundAmount: Money = {
    value: -((refund.amount ?? 0) / 100),
    currency: (refund.currency ?? 'usd').toUpperCase(),
  };

  const desiredNotice = buildBillingPaymentNotice({
    claim,
    encounterId,
    billingProviderRef,
    stripeAccount,
    createdISO: created,
    amount: refundAmount,
    identifiers: [
      {
        system: STRIPE_PAYMENT_ID_SYSTEM,
        value: refund.id,
      },
    ],
    paymentMethod: charge.payment_method_details?.type ?? 'card',
    disposition: `Stripe refund ${refund.id} (${refund.status ?? 'unknown'}) for charge ${charge.id}`,
    outcome: refund.status === 'succeeded' ? 'complete' : failed ? 'error' : 'queued',
    cancelled: failed,
  });

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, refund.id, claim, encounterId, true, {
    refundedByReference: refund.metadata?.refundedByReference,
  });

  await markBillingNoticesForRefundedCharge(oystehr, charge, stripeAccount, secrets);
};

const markBillingNoticesForRefundedCharge = async (
  oystehr: Oystehr,
  charge: Stripe.Charge,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<void> => {
  let refunds: PaymentRefundDTO[];
  try {
    const refundList = await getStripeClient(secrets).refunds.list(
      { charge: charge.id, limit: 100 },
      { stripeAccount }
    );
    refunds = refundList.data.map(stripeRefundToDTO);
  } catch (error) {
    console.error(`Error listing refunds for charge ${charge.id}`, error);
    return;
  }

  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

  const identifierValues = [charge.id, paymentIntentId]
    .filter((id): id is string => Boolean(id))
    .map((id) => `${STRIPE_PAYMENT_ID_SYSTEM}|${id}`)
    .join(',');

  let notices: PaymentNotice[];
  try {
    notices = (
      await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [{ name: 'identifier', value: identifierValues }],
      })
    ).unbundle();
  } catch (error) {
    console.error(`Error searching source PaymentNotices for charge ${charge.id}`, error);
    return;
  }

  const agent = await resolveClaimActor('system', oystehr, undefined, null);
  for (const notice of notices) {
    try {
      // retry variant: a version conflict from an unrelated concurrent update must not
      // discard the webhook's only stamping attempt; stale reservations are cleaned here too
      const staleIds = staleReservationIds([...(parsePaymentRefundsFromNotice(notice) ?? []), ...refunds]);
      await applyRefundsToPaymentNoticeWithRetry(oystehr, notice, refunds, staleIds, recordPaymentNoticeChange(agent));
    } catch (error) {
      console.error(`Error stamping refunds on PaymentNotice/${notice.id}`, error);
    }
  }
};

const upsertPaymentNoticeForChargelessInvoice = async (
  oystehr: Oystehr,
  invoice: Stripe.Invoice,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<void> => {
  if (invoice.charge) {
    console.log(`Invoice ${invoice.id} was settled by a charge; the charge event records it`);
    return;
  }

  const encounterId = encounterIdFromStripeMetadata(invoice.metadata);
  if (!encounterId) {
    console.warn(`Invoice ${invoice.id} has no encounter metadata; skipping PaymentNotice upsert`);
    return;
  }

  const amountPaid = (invoice.amount_paid ?? 0) / 100;
  if (amountPaid <= 0) {
    console.log(`Invoice ${invoice.id} settled for ${amountPaid}; nothing to record`);
    return;
  }

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const billingProviderRef = await billingProviderRefForStripeAccount(oystehr, stripeAccount, secrets);
  const created = new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000).toISOString();
  const settledOutOfBand = invoice.paid_out_of_band === true;

  const paymentAmount: Money = {
    value: amountPaid,
    currency: (invoice.currency ?? 'usd').toUpperCase(),
  };

  const desiredNotice = buildBillingPaymentNotice({
    claim,
    encounterId,
    billingProviderRef,
    stripeAccount,
    createdISO: created,
    amount: paymentAmount,
    identifiers: [
      {
        system: STRIPE_PAYMENT_ID_SYSTEM,
        value: invoice.id,
      },
    ],
    // the money was collected somewhere stripe cannot name, which is what 'other' means here
    paymentMethod: 'other',
    disposition: `Stripe invoice ${invoice.id} ${
      settledOutOfBand ? 'marked paid out of band' : 'paid from credit balance'
    }`,
    outcome: 'complete',
  });

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, invoice.id, claim, encounterId, true);
};

const OUTREACH_CANCEL_REASON_BY_STRIPE_STATUS = {
  paid: 'Invoice was paid',
  void: 'Invoice was voided',
  uncollectible: 'Invoice was marked uncollectible',
};

// EHR invoices have no matching billing Invoice and are skipped.
const updateBillingInvoiceStatus = async (
  oystehr: Oystehr,
  stripeInvoice: Stripe.Invoice,
  stripeStatus: keyof typeof OUTREACH_CANCEL_REASON_BY_STRIPE_STATUS
): Promise<void> => {
  const [invoice] = (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [{ name: 'identifier', value: `${STRIPE_INVOICE_ID_SYSTEM}|${stripeInvoice.id}` }],
    })
  ).unbundle();
  if (!invoice) return;

  const status = invoiceStatusFromStripe(stripeStatus);
  const marksUncollectible = stripeStatus === 'uncollectible';
  // Ignore duplicate events and preserve paid or cancelled status. An uncollectible invoice stays
  // issued, so a repeat of that event is recognised by the marker.
  const isOpen = invoice.status === 'draft' || invoice.status === 'issued';
  if (isOpen && !(marksUncollectible && isInvoiceUncollectible(invoice))) {
    // Fills in the link when the send request stopped before saving it.
    const hostedUrl = stripeInvoice.hosted_invoice_url;
    const linked = hostedUrl ? withHostedInvoiceUrl(invoice, hostedUrl) : invoice;
    await oystehr.fhir.update<Invoice>(
      { ...(marksUncollectible ? withInvoiceUncollectible(linked) : linked), status },
      { optimisticLockingVersionId: invoice.meta?.versionId }
    );
    console.log(`Invoice/${invoice.id} is now ${status}${marksUncollectible ? ' and uncollectible' : ''}`);
  }

  // Not limited to the first event, so a redelivery finishes a cancellation that failed part way.
  await cancelPendingInvoiceOutreach(oystehr, invoice.id!, OUTREACH_CANCEL_REASON_BY_STRIPE_STATUS[stripeStatus]);
};
