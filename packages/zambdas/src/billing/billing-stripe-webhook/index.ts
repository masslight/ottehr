import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, FhirResource, Identifier, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { parsePaymentRefundsFromNotice, staleReservationIds } from 'utils/lib/fhir/paymentRefunds';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { shouldUseOttehrBilling } from '../../shared/candid';
import { wrapHandler } from '../../shared/sentry';
import {
  applyRefundsToPaymentNoticeWithRetry,
  encounterIdFromStripeMetadata,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
  stripeRefundToDTO,
} from '../../shared/stripeIntegration';
import { StripeWebhookParams } from '../../shared/stripeWebhook';
import { ZambdaInput } from '../../shared/types/common';
import { unionIdentifiers } from '../patient-payments';
import {
  billingProviderRefForStripeAccount,
  claimRequestFor,
  createPaymentNotice,
  findBillingClaimForEncounter,
  findPaymentNotice,
  paymentActor,
  paymentNoticeHistoryRequest,
  reconcilePaymentNoticesForClaim,
  recordPaymentNoticeChange,
  stampedStripeAccount,
  stripeAccountExtension,
  withStripeAccountExtension,
} from '../payments';
import { resolveClaimActor } from '../provenance';
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
      if (!recordsAr) {
        console.log(`BILLING_INTEGRATION does not include ottehr; not recording invoice ${invoice.id}`);
        break;
      }
      await upsertPaymentNoticeForChargelessInvoice(oystehr, invoice, stripeAccount, secrets);
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

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, charge.id, claim, encounterId, createIfMissing);
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
  refundedByReference?: string
): Promise<void> => {
  const dedupIdentifier = {
    system: STRIPE_PAYMENT_ID_SYSTEM,
    value: dedupStripeId,
  };
  const found = await findPaymentNotice(oystehr, dedupIdentifier);
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
        const refreshed = mergeStripeOwnedFields(existing, desiredNotice);
        const history = paymentNoticeHistoryRequest({
          targetReference: `PaymentNotice/${existing.id}`,
          before: existing,
          after: refreshed,
          agent,
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

  await persistPaymentNoticeUpsert(
    oystehr,
    desiredNotice,
    refund.id,
    claim,
    encounterId,
    true,
    refund.metadata?.refundedByReference
  );

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
