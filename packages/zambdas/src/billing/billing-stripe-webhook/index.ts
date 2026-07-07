import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, getSecret, PAYMENT_METHOD_EXTENSION_URL, SecretsKeys } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  checkOrCreateM2MClientToken,
  getStripeClient,
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

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

const performEffect = async (oystehr: Oystehr, params: BillingStripeWebhookParams): Promise<void> => {
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
      // refund accounting happens via the refund.* events; re-upserting the gross amount adds nothing
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
      params: [
        { name: 'identifier', value: `${ottehrIdentifierSystem('claim-encounter-id')}|${encounterId}` },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();
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
    // Charge id first: refunds point at charges. The payment intent id is kept alongside for parity
    // with the clinical PaymentNotices, which are keyed by payment intent.
    identifier: [
      { system: STRIPE_PAYMENT_ID_SYSTEM, value: charge.id },
      ...(paymentIntentId ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId }] : []),
    ],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: charge.payment_method_details?.type ?? 'card' }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    recipient: { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` },
  };

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, charge.id, claim, encounterId, secrets);
};

// Payments usually precede claim creation: until the claim exists, request carries only a logical
// reference (the claim-encounter-id identifier) and reconcilePaymentNoticesForClaim adds the literal
// reference once the claim is born.
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
  encounterId: string,
  secrets: ZambdaInput['secrets']
): Promise<void> => {
  const existing = await conditionalCreatePaymentNotice(desiredNotice, dedupStripeId, secrets);
  if (existing?.id) {
    // already existed — rebuild, but never strip an existing link when this run's claim search missed
    const reference = claim?.id ? `Claim/${claim.id}` : existing.request?.reference;
    await oystehr.fhir.update<PaymentNotice>({
      ...desiredNotice,
      id: existing.id,
      request: { ...desiredNotice.request, ...(reference ? { reference } : {}) },
    });
  }

  if (!claim) {
    // the claim may have been created while the notice was being persisted: the other half of this
    // race is create-billing-claim-from-encounter reconciling right after it creates the claim
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
  // refunds carry no metadata — the charge holds the encounter linkage
  const charge = await getStripeClient(secrets).charges.retrieve(chargeId, undefined, { stripeAccount });

  const encounterId = charge.metadata?.oystehr_encounter_id ?? charge.metadata?.encounterId;
  if (!encounterId) {
    console.warn(`Charge ${charge.id} for refund ${refund.id} has no encounter metadata; skipping`);
    return;
  }

  // the refund may arrive before (or without) the charge's own webhook delivery
  await upsertPaymentNoticeOnBillingClaimForCharge(oystehr, charge, secrets);

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const created = new Date(refund.created * 1000).toISOString();
  const failed = refund.status === 'failed' || refund.status === 'canceled';

  // negative amount: a claim's patient AR is the plain sum over its notices
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
    // Patient AR = sum of PaymentNotice.amount where status === 'active'. Failed/canceled refunds are
    // cancelled so they never count; readers must filter on status.
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

  await persistPaymentNoticeUpsert(oystehr, desiredNotice, refund.id, claim, encounterId, secrets);
};

// The @oystehr/sdk transaction helper strips ifNoneExist (see rcm produce-outreach-tasks.ts), so the
// conditional create goes straight to the FHIR API. Raw calls skip the SDK workspace tagging (tag added
// manually) and the match query is tag-scoped because clinical PaymentNotices share this identifier system.
const conditionalCreatePaymentNotice = async (
  notice: PaymentNotice,
  stripeObjectId: string,
  secrets: ZambdaInput['secrets']
): Promise<PaymentNotice | undefined> => {
  const fhirApiUrl = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const ifNoneExist = [
    `identifier=${encodeURIComponent(`${STRIPE_PAYMENT_ID_SYSTEM}|${stripeObjectId}`)}`,
    `_tag=${encodeURIComponent(`${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}`)}`,
  ].join('&');

  const taggedNotice: PaymentNotice = {
    ...notice,
    meta: { ...notice.meta, tag: [...(notice.meta?.tag ?? []), BILLING_RESOURCE_TAG] },
  };

  const res = await fetch(`${fhirApiUrl}/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${m2mToken}`,
      'content-type': 'application/fhir+json',
      accept: 'application/fhir+json',
    },
    body: JSON.stringify({
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [{ resource: taggedNotice, request: { method: 'POST', url: 'PaymentNotice', ifNoneExist } }],
    }),
  });

  if (res.status === 412) {
    console.log(`Conditional create matched multiple PaymentNotices for ${stripeObjectId}, skipping`);
    return undefined;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Conditional create for PaymentNotice failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const bundle = (await res.json()) as { entry?: { resource?: PaymentNotice; response?: { status?: string } }[] };
  const entry = bundle.entry?.[0];
  if (!entry?.resource) {
    throw new Error('Conditional create for PaymentNotice returned no resource in the transaction response');
  }
  // 201 = newly created; 200 = matched an existing notice
  if (entry.response?.status?.startsWith('201')) {
    return undefined;
  }
  return entry.resource;
};
