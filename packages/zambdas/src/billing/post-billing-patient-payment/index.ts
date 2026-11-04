import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Claim,
  Encounter,
  FhirResource,
  Identifier,
  Money,
  PaymentNotice,
  PaymentReconciliation,
  ProvenanceAgent,
  Reference,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL, PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  getStripeCustomerIdFromAccount,
  makeOptimisticLockIfMatchHeader,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { TIMEZONES } from 'utils/lib/types/constants';
import { PostBillingPatientPaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  FHIR_RESOURCE_NOT_FOUND,
  GENERIC_STRIPE_PAYMENT_ERROR,
  NOT_AUTHORIZED,
  parseStripeError,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils/lib/types/errors';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { practitionerRefForUser } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM, stripeEncounterMetadata } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { ensurePaymentTaskForNotice, unionIdentifiers } from '../patient-payments';
import {
  billingProviderRefForStripeAccount,
  claimRequestFor,
  createPaymentNotice,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  findBillingClaimForEncounter,
  paymentNoticeHistoryRequest,
  reconcilePaymentNoticesForClaim,
  stripeAccountExtension,
} from '../payments';
import { humanClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

type PostBillingPatientPaymentParams = ValidatedZambdaInput<typeof PostBillingPatientPaymentInputSchema>;

const ZAMBDA_NAME = 'post-billing-patient-payment';

let m2mToken: string;

// Records a patient payment taken in the EHR as a billing PaymentNotice, charging the saved card
// through Stripe first for card payments, and schedules the Candid sync / receipt Task.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(PostBillingPatientPaymentInputSchema, input);
  const { patientId, encounterId, secrets } = params;

  const user = await getUser(getUserToken(input), secrets);
  if (!user.profile) {
    throw NOT_AUTHORIZED;
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);

  // the billing client cannot see Encounters, so check the id before recording money against it
  await fetchById<Encounter>(clinicalOystehr, 'Encounter', encounterId);
  const submitterRef = await practitionerRefForUser(user, clinicalOystehr);

  const notice = await performEffect({ ...params, submitterRef }, clinicalOystehr, billingOystehr);

  return { statusCode: 200, body: JSON.stringify({ notice, patientId, encounterId }) };
});

interface EffectInput extends PostBillingPatientPaymentParams {
  submitterRef: Reference;
}

const performEffect = async (
  input: EffectInput,
  clinicalOystehr: Oystehr,
  billingOystehr: Oystehr
): Promise<PaymentNotice> => {
  const { encounterId, paymentDetails, secrets } = input;
  // every payment carries the identifier so billing AR picks it up; a request without a client
  // key simply cannot be replayed
  const dedupValue = `${encounterId}_${paymentDetails.idempotencyKey ?? randomUUID()}`;
  const dedupIdentifier: Identifier = { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: dedupValue };

  // Idempotency guard: a replayed request (e.g. resent after a response was lost on a flaky
  // connection) returns the recorded notice instead of writing a duplicate, and for card payments
  // before charging Stripe again.
  if (paymentDetails.idempotencyKey) {
    const existing = (
      await billingOystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [{ name: 'identifier', value: `${dedupIdentifier.system}|${dedupIdentifier.value}` }],
      })
    ).unbundle()[0];
    if (existing) {
      console.log('idempotent replay detected; returning existing PaymentNotice', existing.id);
      let replayNotice = existing;
      if (!replayNotice.request?.reference && replayNotice.id) {
        const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
        if (claim) {
          await reconcilePaymentNoticesForClaim(billingOystehr, claim);
          replayNotice = await billingOystehr.fhir.get<PaymentNotice>({
            resourceType: 'PaymentNotice',
            id: replayNotice.id,
          });
        }
      }
      // A replay must finish linking and scheduling work left by the first attempt.
      await ensurePaymentTaskForNotice(clinicalOystehr, replayNotice, encounterId);
      return replayNotice;
    }
  }

  const stripePayment =
    paymentDetails.paymentMethod === 'card'
      ? await chargeSavedCard(input, paymentDetails.paymentMethodId, clinicalOystehr)
      : undefined;
  const paymentIntent = stripePayment?.paymentIntent;
  const chargeId =
    typeof paymentIntent?.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent?.latest_charge?.id;

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  // the provider owed the money: for a card payment the org behind the Stripe account it landed in,
  // as the billing webhook records it; otherwise the claim's provider when a claim exists, else the
  // default billing organization (the same default claim creation uses)
  const payeeRef: Reference = stripePayment
    ? await billingProviderRefForStripeAccount(billingOystehr, stripePayment.stripeAccount, secrets)
    : claim?.provider ?? { reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets) };
  const desiredNotice = makePaymentNotice({
    ...input,
    claim,
    payeeRef,
    stripeAccount: stripePayment && { stripeAccount: stripePayment.stripeAccount },
    identifiers: [
      dedupIdentifier,
      ...[paymentIntent?.id, chargeId]
        .filter((id): id is string => Boolean(id))
        .map((value) => ({ system: STRIPE_PAYMENT_ID_SYSTEM, value })),
    ],
  });

  // The billing stripe webhook records the same charge, keyed by the charge id, and may get there
  // first: both writers dedup on that id and merge into whichever notice exists, and whichever
  // stores it first records the payment in claim history. Without a charge, the conditional create
  // closes the window where two replays race past the guard above.
  const agent = humanClaimActor(input.submitterRef);
  const stored = await createPaymentNotice({
    oystehr: billingOystehr,
    notice: desiredNotice,
    dedupIdentifier: chargeId
      ? { system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId }
      : { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: dedupValue },
    agent,
  });
  let storedNotice = stored.created
    ? stored.notice
    : await mergeIntoWebhookNotice(billingOystehr, stored.notice, desiredNotice, agent);

  if (!storedNotice.request?.reference && storedNotice.id) {
    // the webhook may have stored the charge before the claim existed, or the claim may have appeared
    // while the notice was being stored; reconcile links it along with its claim history, and the
    // notice is re-read so the caller gets the linked version
    const claimToLink = claim ?? (await findBillingClaimForEncounter(billingOystehr, encounterId));
    if (claimToLink) {
      await reconcilePaymentNoticesForClaim(billingOystehr, claimToLink);
      storedNotice = await billingOystehr.fhir.get<PaymentNotice>({
        resourceType: 'PaymentNotice',
        id: storedNotice.id,
      });
    }
  }

  // done idempotently (and again on replay above) so a first attempt that wrote the notice but died
  // before this point still gets its downstream work scheduled on retry
  await ensurePaymentTaskForNotice(clinicalOystehr, storedNotice, encounterId);

  return storedNotice;
};

const chargeSavedCard = async (
  input: EffectInput,
  paymentMethodId: string,
  clinicalOystehr: Oystehr
): Promise<{ paymentIntent: Stripe.PaymentIntent; stripeAccount: string | undefined }> => {
  const { patientId, encounterId, paymentDetails, secrets } = input;
  const { account } = await getAccountAndCoverageResourcesForPatient(patientId, clinicalOystehr);
  if (!account) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, clinicalOystehr);
  const customerId = getStripeCustomerIdFromAccount(account, stripeAccount);
  if (!customerId) {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await getStripeClient(secrets).paymentIntents.create(
      {
        amount: paymentDetails.amountInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        description: paymentDetails.description || `Payment for encounter ${encounterId}`,
        confirm: true,
        metadata: stripeEncounterMetadata({ encounterId, patientId }),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      },
      {
        stripeAccount, // Connected account ID if any
        // reusing the client's key means a retried request returns the same PaymentIntent rather
        // than charging the card a second time
        ...(paymentDetails.idempotencyKey ? { idempotencyKey: paymentDetails.idempotencyKey } : {}),
      }
    );
  } catch (e) {
    throw parseStripeError(e);
  }
  if (paymentIntent.status !== 'succeeded') {
    throw GENERIC_STRIPE_PAYMENT_ERROR;
  }
  console.log('Payment Intent created:', paymentIntent.id);
  return { paymentIntent, stripeAccount };
};

// The webhook's copy has no submitter or EHR identifier; add ours, keeping its refund stamps and its
// claim link, which only reconcile adds so the history recorded before it comes along. The write is
// locked to the version it read, so a refund stamped since is re-read instead of overwritten.
const mergeIntoWebhookNotice = async (
  billingOystehr: Oystehr,
  storedNotice: PaymentNotice,
  desiredNotice: PaymentNotice,
  agent: ProvenanceAgent
): Promise<PaymentNotice> => {
  const [dedupIdentifier] = desiredNotice.identifier ?? [];
  const alreadyOurs = storedNotice.identifier?.some(
    (identifier) => identifier.system === dedupIdentifier?.system && identifier.value === dedupIdentifier?.value
  );
  if (alreadyOurs || !storedNotice.id) return storedNotice;
  const noticeId = storedNotice.id;

  return withVersionConflictRetries(async (attempt) => {
    const existing =
      attempt === 1
        ? storedNotice
        : await billingOystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: noticeId });
    const merged: PaymentNotice = {
      ...existing,
      request: { ...desiredNotice.request, reference: existing.request?.reference },
      identifier: unionIdentifiers(existing.identifier, desiredNotice.identifier),
      payee: desiredNotice.payee,
      recipient: desiredNotice.recipient,
      contained: desiredNotice.contained,
      extension: [
        ...(existing.extension ?? []).filter(
          (ext) => ext.url !== PAYMENT_METHOD_EXTENSION_URL && ext.url !== PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL
        ),
        ...(desiredNotice.extension ?? []),
      ],
    };
    const history = paymentNoticeHistoryRequest({
      targetReference: `PaymentNotice/${noticeId}`,
      before: existing,
      after: merged,
      agent,
    });
    await billingOystehr.fhir.transaction<FhirResource>({
      requests: [
        {
          method: 'PUT',
          url: `/PaymentNotice/${noticeId}`,
          resource: merged,
          ifMatch: makeOptimisticLockIfMatchHeader(existing),
        },
        ...(history ? [history] : []),
      ],
    });
    return merged;
  });
};

const makePaymentNotice = (input: {
  encounterId: string;
  paymentDetails: PostBillingPatientPaymentParams['paymentDetails'];
  submitterRef: Reference;
  claim: Claim | undefined;
  payeeRef: Reference;
  // the account a card payment was taken on; absent for payments outside Stripe
  stripeAccount: { stripeAccount: string | undefined } | undefined;
  identifiers: Identifier[];
}): PaymentNotice => {
  const { encounterId, paymentDetails, submitterRef, claim, payeeRef, stripeAccount, identifiers } = input;
  const { paymentMethod, amountInCents } = paymentDetails;

  // the created timestamp is in UTC and the exact date in any timezone can always be derived from there
  // for now the payment date is set to the default timezone (US Eastern)
  const now = DateTime.now();
  const created = now.toUTC().toISO();
  if (!created) {
    throw new Error('Failed to serialize the current time for PaymentNotice creation');
  }
  const paymentDate = now.setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');

  const paymentAmount: Money = {
    value: amountInCents / 100,
    currency: 'USD',
  };

  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created,
    disposition:
      paymentMethod === 'card'
        ? 'card payment intent created and confirmed with Stripe'
        : `${paymentMethod} collected from patient`,
    outcome: 'complete',
    paymentDate,
    paymentAmount,
    detail: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
        submitter: submitterRef,
      },
    ],
  };

  return {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created,
    paymentDate,
    amount: paymentAmount,
    identifier: identifiers,
    extension: [
      { url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod },
      ...(stripeAccount ? [stripeAccountExtension(stripeAccount.stripeAccount)] : []),
    ],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };
};
