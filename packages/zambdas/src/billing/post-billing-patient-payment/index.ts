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
  SPECIFIC_STRIPE_PAYMENT_ERROR,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils/lib/types/errors';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { practitionerRefForUser } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import {
  getStripeClient,
  STRIPE_METADATA_KEYS,
  STRIPE_PAYMENT_ID_SYSTEM,
  stripeEncounterMetadata,
} from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { ensurePaymentTaskForNotice, unionIdentifiers } from '../patient-payments';
import {
  billingProviderRefForStripeAccount,
  claimRequestFor,
  createPaymentNotice,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
  EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM,
  findBillingClaimForEncounter,
  findPaymentNotice,
  isPendingEhrPaymentNotice,
  paymentNoticeHistoryRequest,
  pendingEhrPaymentNotice,
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
  const { encounterId, paymentDetails } = input;
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

  let storedNotice =
    paymentDetails.paymentMethod === 'card'
      ? await recordCardPayment(input, paymentDetails.paymentMethodId, dedupValue, clinicalOystehr, billingOystehr)
      : await recordCollectedPayment(input, dedupValue, billingOystehr);

  if (!storedNotice.request?.reference && storedNotice.id) {
    // the claim may have appeared while the notice was being stored, or the webhook may have activated
    // the reservation before the claim existed; reconcile links it along with its claim history, and
    // the notice is re-read so the caller gets the linked version
    const claimToLink = await findBillingClaimForEncounter(billingOystehr, encounterId);
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

// Cash, check and the other methods collected without Stripe. The conditional create closes the window
// where two replays race past the idempotency guard.
const recordCollectedPayment = async (
  input: EffectInput,
  ehrPaymentId: string,
  billingOystehr: Oystehr
): Promise<PaymentNotice> => {
  const ehrPaymentIdentifier = { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId };
  const claim = await findBillingClaimForEncounter(billingOystehr, input.encounterId);
  // the claim's provider when a claim exists, else the default billing organization (the same default
  // claim creation uses)
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, input.secrets),
  };
  const stored = await createPaymentNotice({
    oystehr: billingOystehr,
    notice: makePaymentNotice({
      ...input,
      claim,
      payeeRef,
      stripeAccount: undefined,
      identifiers: [ehrPaymentIdentifier],
    }),
    dedupIdentifier: ehrPaymentIdentifier,
    agent: humanClaimActor(input.submitterRef),
  });
  return stored.notice;
};

// The payment is reserved as a draft before the card is charged, and the charge carries the
// reservation's id. The billing stripe webhook therefore always finds this payment's notice, which it
// activates or refreshes but never creates, so the two writers never race to create one: each
// activates the reservation with a write locked to the version it read, and the loser merges into
// the winner's notice.
const recordCardPayment = async (
  input: EffectInput,
  paymentMethodId: string,
  ehrPaymentId: string,
  clinicalOystehr: Oystehr,
  billingOystehr: Oystehr
): Promise<PaymentNotice> => {
  const { encounterId, secrets } = input;
  const agent = humanClaimActor(input.submitterRef);
  const { customerId, stripeAccount } = await savedCardCustomer(input, clinicalOystehr);
  // the org behind the Stripe account the money lands in, as the billing webhook records it
  const payeeRef = await billingProviderRefForStripeAccount(billingOystehr, stripeAccount, secrets);
  const noticeFor = (claim: Claim | undefined, identifiers: Identifier[]): PaymentNotice =>
    makePaymentNotice({ ...input, claim, payeeRef, stripeAccount: { stripeAccount }, identifiers });

  // A replay reuses the reservation of the attempt it repeats. One that overlapped that attempt passed
  // the idempotency guard before the payment was activated; activation keeps the reservation
  // identifier, so the payment is found here and returned without charging the card again. Requests
  // reserving at the same moment can each store a reservation (the conditional create does not make
  // them unique); the charge settles which one records the payment, see chargeSavedCard.
  const reservationIdentifier = { system: EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId };
  let pending: PaymentNotice;
  try {
    ({ notice: pending } = await createPaymentNotice({
      oystehr: billingOystehr,
      notice: pendingEhrPaymentNotice(noticeFor(undefined, []), ehrPaymentId),
      dedupIdentifier: reservationIdentifier,
      agent: undefined,
    }));
  } catch (error) {
    // The reservation create sends no version, so a 412 means its condition matched several notices:
    // requests that reserved the payment at the same moment are still settling which one charges.
    if (!isPreconditionFailed(error)) throw error;
    console.log(`Several reservations hold EHR payment ${ehrPaymentId}; waiting for the one that charged`);
    return waitForRecordedPayment(billingOystehr, ehrPaymentId);
  }
  if (!isPendingEhrPaymentNotice(pending)) {
    console.log('idempotent replay detected; the reserved payment is already recorded', pending.id);
    return pending;
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await chargeSavedCard(input, {
      paymentMethodId,
      customerId,
      stripeAccount,
      ehrPaymentId,
      reservationId: pending.id!,
    });
  } catch (error) {
    const lost = error instanceof ReservationLostError;
    await cancelPendingPaymentNotice(billingOystehr, pending, { release: lost });
    if (lost) {
      console.log(`Reservation PaymentNotice/${pending.id} lost the charge to another request for the payment`);
      return waitForRecordedPayment(billingOystehr, ehrPaymentId);
    }
    throw error;
  }
  const chargeId =
    typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  const desiredNotice = noticeFor(claim, [
    { system: EHR_PATIENT_PAYMENT_ID_SYSTEM, value: ehrPaymentId },
    ...[paymentIntent.id, chargeId]
      .filter((id): id is string => Boolean(id))
      .map((value) => ({ system: STRIPE_PAYMENT_ID_SYSTEM, value })),
    reservationIdentifier,
  ]);

  const activation = await activatePendingPaymentNotice(billingOystehr, pending, desiredNotice, agent);
  return activation.activated
    ? activation.notice
    : mergeIntoWebhookNotice(billingOystehr, activation.notice, desiredNotice, agent);
};

// Records the reservation as the payment, in claim history as the payment's creation. A reservation
// the webhook activated first is returned as it is, for the caller to merge into.
const activatePendingPaymentNotice = (
  billingOystehr: Oystehr,
  pending: PaymentNotice,
  desiredNotice: PaymentNotice,
  agent: ProvenanceAgent
): Promise<{ notice: PaymentNotice; activated: boolean }> => {
  const noticeId = pending.id;
  if (!noticeId) throw new Error('The reserved PaymentNotice has no id');
  return withVersionConflictRetries(async (attempt) => {
    const existing =
      attempt === 1
        ? pending
        : await billingOystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: noticeId });
    if (!isPendingEhrPaymentNotice(existing)) {
      return { notice: existing, activated: false };
    }
    const activated: PaymentNotice = { ...desiredNotice, id: noticeId, meta: existing.meta };
    const history = paymentNoticeHistoryRequest({
      targetReference: `PaymentNotice/${noticeId}`,
      after: activated,
      agent,
    });
    await billingOystehr.fhir.transaction<FhirResource>({
      requests: [
        {
          method: 'PUT',
          url: `/PaymentNotice/${noticeId}`,
          resource: activated,
          ifMatch: makeOptimisticLockIfMatchHeader(existing),
        },
        ...(history ? [history] : []),
      ],
    });
    return { notice: activated, activated: true };
  });
};

// A charge that failed leaves its reservation cancelled. Only a draft is cancelled: should the charge
// have gone through after all, the webhook activates the reservation, and that is kept. Failing to
// cancel is logged rather than thrown so the caller sees the charge error; no payment reader lists
// the draft either way. A reservation that lost the charge to another request's (`release`) also gives
// up its identifier, leaving it to the notice that records the payment; a declined charge's keeps it,
// so a replay finds it and gets the decline Stripe kept for the key.
const cancelPendingPaymentNotice = async (
  billingOystehr: Oystehr,
  pending: PaymentNotice,
  { release }: { release: boolean }
): Promise<void> => {
  const noticeId = pending.id;
  if (!noticeId) return;
  try {
    await withVersionConflictRetries(async (attempt) => {
      const existing =
        attempt === 1
          ? pending
          : await billingOystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: noticeId });
      if (!isPendingEhrPaymentNotice(existing) || existing.status !== 'draft') return;
      await billingOystehr.fhir.transaction<FhirResource>({
        requests: [
          {
            method: 'PUT',
            url: `/PaymentNotice/${noticeId}`,
            resource: {
              ...existing,
              status: 'cancelled',
              identifier: release
                ? existing.identifier?.filter(
                    (identifier) => identifier.system !== EHR_PENDING_PATIENT_PAYMENT_ID_SYSTEM
                  )
                : existing.identifier,
              contained: existing.contained?.map((resource) =>
                resource.resourceType === 'PaymentReconciliation' ? { ...resource, status: 'cancelled' } : resource
              ),
            },
            ifMatch: makeOptimisticLockIfMatchHeader(existing),
          },
        ],
      });
    });
  } catch (error) {
    console.error(`Could not cancel the reserved PaymentNotice/${noticeId} of a failed charge`, error);
  }
};

const savedCardCustomer = async (
  input: EffectInput,
  clinicalOystehr: Oystehr
): Promise<{ customerId: string; stripeAccount: string | undefined }> => {
  const { patientId, encounterId } = input;
  const { account } = await getAccountAndCoverageResourcesForPatient(patientId, clinicalOystehr);
  if (!account) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, clinicalOystehr);
  const customerId = getStripeCustomerIdFromAccount(account, stripeAccount);
  if (!customerId) {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }
  return { customerId, stripeAccount };
};

const isPreconditionFailed = (error: unknown): boolean => {
  const { code, statusCode } = (error ?? {}) as { code?: number; statusCode?: number };
  return code === 412 || statusCode === 412;
};

// Another request for the same payment charged the card under its own reservation.
class ReservationLostError extends Error {
  constructor() {
    super('Another request for this payment charged the card under its own reservation');
    this.name = 'ReservationLostError';
  }
}

// Stripe refuses a key that another request is using, or used with other parameters.
const isIdempotencyConflict = (error: unknown): boolean => {
  const stripeError = error as { type?: string; rawType?: string; code?: string } | undefined;
  return (
    stripeError?.type === 'StripeIdempotencyError' ||
    stripeError?.rawType === 'idempotency_error' ||
    stripeError?.code === 'idempotency_key_in_use'
  );
};

// How long a request whose reservation lost the charge waits for the winner to record the payment,
// which it does right after its charge returns.
export const RECORDED_PAYMENT_POLL = { attempts: 15, intervalMs: 1000 };

const waitForRecordedPayment = async (billingOystehr: Oystehr, ehrPaymentId: string): Promise<PaymentNotice> => {
  for (let attempt = 1; attempt <= RECORDED_PAYMENT_POLL.attempts; attempt++) {
    const recorded = await findPaymentNotice(billingOystehr, {
      system: EHR_PATIENT_PAYMENT_ID_SYSTEM,
      value: ehrPaymentId,
    });
    if (recorded) return recorded;
    if (attempt < RECORDED_PAYMENT_POLL.attempts) {
      await new Promise((resolve) => setTimeout(resolve, RECORDED_PAYMENT_POLL.intervalMs));
    }
  }
  // the card may well have been charged, so the user must not be told the payment failed
  throw SPECIFIC_STRIPE_PAYMENT_ERROR(
    'This payment is already being processed. Refresh the page to see it before trying again.'
  );
};

// The charge carries the id of this request's reservation, under the client's idempotency key. Stripe
// keeps one PaymentIntent per key and refuses the key with different parameters, so of requests that
// reserved separate notices for one payment exactly one charges the card; the others get
// ReservationLostError. The resource id is what makes the parameters differ, as nothing in FHIR keeps
// two concurrent reservations from being stored.
const chargeSavedCard = async (
  input: EffectInput,
  card: {
    paymentMethodId: string;
    customerId: string;
    stripeAccount: string | undefined;
    ehrPaymentId: string;
    reservationId: string;
  }
): Promise<Stripe.PaymentIntent> => {
  const { patientId, encounterId, paymentDetails, secrets } = input;
  const { paymentMethodId, customerId, stripeAccount, ehrPaymentId, reservationId } = card;

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
        metadata: {
          ...stripeEncounterMetadata({ encounterId, patientId }),
          // Stripe copies them to the charge, where the billing webhook finds the reservation by them
          [STRIPE_METADATA_KEYS.ehrPaymentId]: ehrPaymentId,
          [STRIPE_METADATA_KEYS.ehrPaymentNoticeId]: reservationId,
        },
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
    if (isIdempotencyConflict(e)) throw new ReservationLostError();
    throw parseStripeError(e);
  }
  if (paymentIntent.status !== 'succeeded') {
    throw GENERIC_STRIPE_PAYMENT_ERROR;
  }
  console.log('Payment Intent created:', paymentIntent.id);
  return paymentIntent;
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
