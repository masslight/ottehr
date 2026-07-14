import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, getSecret, PAYMENT_METHOD_EXTENSION_URL, SecretsKeys } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  checkOrCreateM2MClientToken,
  getStripeClient,
  shouldUseOttehrBilling,
  STRIPE_PAYMENT_ID_SYSTEM,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createBillingClient, reconcilePaymentNoticesForClaim } from '../shared';
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
      console.log(`Charge event for ${charge.id}, oystehr_encounter_id: ${charge.metadata?.oystehr_encounter_id}`);
      await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, secrets);
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
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }
};

const findBillingClaimForEncounter = async (oystehr: Oystehr, encounterId: string): Promise<Claim | undefined> => {
  const claims = (
    await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [{ name: 'identifier', value: `${ottehrIdentifierSystem('claim-encounter-id')}|${encounterId}` }],
    })
  ).unbundle();
  if (claims.length > 1) {
    throw new Error(`Found ${claims.length} billing Claims for encounter ${encounterId}, cannot pick one safely`);
  }
  return claims[0];
};

const upsertPaymentNoticeOnBillingClaimForCharge = async (
  oystehr: Oystehr,
  charge: Stripe.Charge,
  secrets: ZambdaInput['secrets']
): Promise<void> => {
  const encounterId = charge.metadata?.oystehr_encounter_id ?? charge.metadata?.encounterId;
  if (!encounterId) {
    console.warn(`Charge ${charge.id} has no encounter metadata; skipping PaymentNotice upsert`);
    return;
  }

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);

  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : undefined;
  const created = new Date(charge.created * 1000).toISOString();

  const paymentAmount: Money = {
    value: (charge.amount ?? 0) / 100,
    currency: (charge.currency ?? 'usd').toUpperCase(),
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created,
    disposition: `Stripe charge ${charge.id} ${charge.status ?? ''}`.trim(),
    outcome: charge.paid ? 'complete' : 'partial',
    paymentDate: created.slice(0, 10),
    paymentAmount,
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created,
    amount: paymentAmount,
    // charge id is the dedup key, the payment intent id matches how clinical notices are keyed
    identifier: [
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: charge.id },
      ...(paymentIntentId ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId }] : []),
    ],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: charge.payment_method_details?.type ?? 'card' }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    recipient: { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` },
  };

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, charge.id, claim, encounterId);
};

// before the claim exists this is a logical reference only, reconciled once the claim is created
const claimRequestFor = (claim: Claim | undefined, encounterId: string): Reference => ({
  type: 'Claim',
  identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId },
  ...(claim?.id ? { reference: `Claim/${claim.id}` } : {}),
});

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
  // refunds carry no metadata, the charge has the encounter id
  const charge = await getStripeClient(secrets).charges.retrieve(chargeId, undefined, { stripeAccount });

  const encounterId = charge.metadata?.oystehr_encounter_id ?? charge.metadata?.encounterId;
  if (!encounterId) {
    console.warn(`Charge ${charge.id} for refund ${refund.id} has no encounter metadata; skipping`);
    return;
  }

  // covers refunds whose charge event was never delivered
  await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, secrets);

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const created = new Date(refund.created * 1000).toISOString();
  const failed = refund.status === 'failed' || refund.status === 'canceled';

  // negative so patient AR is a plain sum over a claim's notices
  const refundAmount: Money = {
    value: -((refund.amount ?? 0) / 100),
    currency: (refund.currency ?? 'usd').toUpperCase(),
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: failed ? 'cancelled' : 'active',
    created,
    disposition: `Stripe refund ${refund.id} (${refund.status ?? 'unknown'}) for charge ${charge.id}`,
    outcome: refund.status === 'succeeded' ? 'complete' : failed ? 'error' : 'queued',
    paymentDate: created.slice(0, 10),
    paymentAmount: refundAmount,
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    // failed refunds are cancelled and must not count toward patient AR
    status: failed ? 'cancelled' : 'active',
    request: claimRequestFor(claim, encounterId),
    created,
    amount: refundAmount,
    identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: refund.id }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: charge.payment_method_details?.type ?? 'card' }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    recipient: { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` },
  };

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, refund.id, claim, encounterId);
};
