import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Identifier, Money, Organization, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { shouldUseOttehrBilling } from '../../shared/candid';
import { wrapHandler } from '../../shared/sentry';
import {
  encounterIdFromStripeMetadata,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
} from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { claimRequestFor, findBillingClaimForEncounter } from '../payments';
import { createBillingClient, reconcilePaymentNoticesForClaim, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../shared';
import { BillingStripeWebhookParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'billing-stripe-webhook';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { event } = params;
  console.log('Verified Stripe event:', event.id, event.type, 'connected account:', event.account ?? 'none');

  // Acknowledge with 200 so Stripe doesn't retry or disable the endpoint.
  if (!shouldUseOttehrBilling(params.secrets)) {
    console.log('BILLING_INTEGRATION does not include ottehr; acknowledging event without processing');
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

export const performEffect = async (oystehr: Oystehr, params: BillingStripeWebhookParams): Promise<void> => {
  const { event, secrets } = params;
  switch (event.type) {
    case 'charge.succeeded':
    case 'charge.updated': {
      const charge = event.data.object as Stripe.Charge;
      console.log(`Charge event for ${charge.id}, invoice: ${chargeInvoiceId(charge) ?? 'none'}`);
      await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, event.account, secrets);
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
      await upsertPaymentNoticeForRefund(oystehr, refund, event.account, secrets);
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Invoice paid event for ${invoice.id}, charge: ${invoice.charge ?? 'none'}`);
      await upsertPaymentNoticeForChargelessInvoice(oystehr, invoice, event.account, secrets);
      break;
    }
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }
};

// picks the billing provider org stamped with the connected account id or default org otherwise,
// providers sharing an account share a TIN so the first match is fine
const billingProviderRefForStripeAccount = async (
  oystehr: Oystehr,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<Reference> => {
  if (stripeAccount) {
    const providers = (
      await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [{ name: 'identifier', value: `${STRIPE_ACCOUNT_IDENTIFIER_SYSTEM}|${stripeAccount}` }],
      })
    ).unbundle();
    if (providers[0]?.id) return { reference: `Organization/${providers[0].id}` };
    console.warn(`No billing provider carries stripe account ${stripeAccount}, using the default organization`);
  }
  return { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` };
};

const buildBillingPaymentNotice = (params: {
  claim: Claim | undefined;
  encounterId: string;
  billingProviderRef: Reference;
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
  secrets: ZambdaInput['secrets']
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

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, charge.id, claim, encounterId);
};

const persistPaymentNoticeUpsert = async (
  oystehr: Oystehr,
  desiredNotice: PaymentNotice,
  dedupStripeId: string,
  claim: Claim | undefined,
  encounterId: string
): Promise<void> => {
  // tag scoped because clinical PaymentNotices use the same identifier system
  const returned = await oystehr.fhir.create<PaymentNotice>(desiredNotice, {
    ifNoneExist: [
      { name: 'identifier', value: `${STRIPE_PAYMENT_ID_SYSTEM}|${dedupStripeId}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ],
  });

  // refresh the notice but keep an existing link if the claim search missed
  const reference = claim?.id ? `Claim/${claim.id}` : returned.request?.reference;
  await oystehr.fhir.update<PaymentNotice>({
    ...desiredNotice,
    id: returned.id,
    request: { ...desiredNotice.request, ...(reference ? { reference } : {}) },
  });

  if (!claim) {
    // the claim may have appeared while the notice was being stored
    const lateClaim = await findBillingClaimForEncounter(oystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(oystehr, lateClaim);
    }
  }
};

const upsertPaymentNoticeForRefund = async (
  oystehr: Oystehr,
  refund: Stripe.Refund,
  stripeAccount: string | undefined,
  secrets: ZambdaInput['secrets']
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
  await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, stripeAccount, secrets);

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

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, refund.id, claim, encounterId);
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

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, invoice.id, claim, encounterId);
};
