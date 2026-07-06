import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Money, PaymentNotice, PaymentReconciliation } from 'fhir/r4b';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, getSecret, PAYMENT_METHOD_EXTENSION_URL, SecretsKeys } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { checkOrCreateM2MClientToken, STRIPE_PAYMENT_ID_SYSTEM, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
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
      // TODO (OTR-2679): refunds are the refund.* path's job; re-upserting the gross amount would mask them
      const charge = event.data.object as Stripe.Charge;
      console.log(`Ignoring charge.refunded for ${charge.id}`);
      break;
    }
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const refund = event.data.object;
      console.log(`Refund event for ${refund.id}, charge: ${refund.charge}`);
      // TODO (OTR-2679): upsert a refund PaymentNotice; resolve the encounter via refund.charge
      break;
    }
    default:
      console.log('Ignoring unhandled event type:', event.type);
  }
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

  const claims = (
    await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: 'identifier', value: `${ottehrIdentifierSystem('claim-encounter-id')}|${encounterId}` },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();

  const claim = claims[0];
  if (!claim?.id) {
    console.warn(
      `No billing Claim found for encounter ${encounterId}; skipping PaymentNotice upsert for charge ${charge.id}`
    );
    return;
  }

  const stripePaymentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.id;
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
    request: { reference: `Claim/${claim.id}`, type: 'Claim' },
    created,
    amount: paymentAmount,
    identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: stripePaymentId }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: charge.payment_method_details?.type ?? 'card' }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    recipient: { reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, secrets)}` },
  };

  const existing = await conditionalCreatePaymentNotice(desiredNotice, stripePaymentId, secrets);
  if (!existing?.id) {
    return;
  }

  // already existed — rebuild from the charge so the contained reconciliation never drifts
  await oystehr.fhir.update<PaymentNotice>({ ...desiredNotice, id: existing.id });
};

// The @oystehr/sdk transaction helper strips ifNoneExist (see rcm produce-outreach-tasks.ts), so the
// conditional create goes straight to the FHIR API. Raw calls skip the SDK workspace tagging (tag added
// manually) and the match query is tag-scoped because clinical PaymentNotices share this identifier system.
const conditionalCreatePaymentNotice = async (
  notice: PaymentNotice,
  stripePaymentId: string,
  secrets: ZambdaInput['secrets']
): Promise<PaymentNotice | undefined> => {
  const fhirApiUrl = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const ifNoneExist = [
    `identifier=${encodeURIComponent(`${STRIPE_PAYMENT_ID_SYSTEM}|${stripePaymentId}`)}`,
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
    console.log(`Conditional create matched multiple PaymentNotices for ${stripePaymentId}, skipping`);
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
