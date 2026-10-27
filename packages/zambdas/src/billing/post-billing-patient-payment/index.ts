import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Claim, Encounter, Identifier, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
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
// eslint-disable-next-line no-restricted-imports -- checks the Encounter, resolves the submitter and Stripe account, and schedules the payment Task
import { createClinicalOystehrClient } from '../../shared/helpers';
import { practitionerRefForUser } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM, stripeEncounterMetadata } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { ensurePaymentTaskForNotice, unionIdentifiers } from '../patient-payments';
import { claimRequestFor, EHR_PATIENT_PAYMENT_ID_SYSTEM, findBillingClaimForEncounter } from '../payments';
import { createBillingClient, fetchById, reconcilePaymentNoticesForClaim } from '../shared';

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
  const dedupIdentifier: Identifier = {
    system: EHR_PATIENT_PAYMENT_ID_SYSTEM,
    value: `${encounterId}_${paymentDetails.idempotencyKey ?? randomUUID()}`,
  };

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
      // a first attempt may have written the notice but died before scheduling the Task
      await ensurePaymentTaskForNotice(clinicalOystehr, existing, encounterId);
      return existing;
    }
  }

  const paymentIntent =
    paymentDetails.paymentMethod === 'card'
      ? await chargeSavedCard(input, paymentDetails.paymentMethodId, clinicalOystehr)
      : undefined;
  const chargeId =
    typeof paymentIntent?.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent?.latest_charge?.id;

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  const desiredNotice = makePaymentNotice({
    ...input,
    claim,
    identifiers: [
      dedupIdentifier,
      ...[paymentIntent?.id, chargeId]
        .filter((id): id is string => Boolean(id))
        .map((value) => ({ system: STRIPE_PAYMENT_ID_SYSTEM, value })),
    ],
    secrets,
  });

  // The billing stripe webhook records the same charge, keyed by the charge id, and may get there
  // first: both writers dedup on that id and merge into whichever notice exists. Without a charge,
  // the conditional create closes the window where two replays race past the guard above.
  const paymentNotice = await billingOystehr.fhir.create<PaymentNotice>(desiredNotice, {
    ifNoneExist: [
      {
        name: 'identifier',
        value: chargeId
          ? `${STRIPE_PAYMENT_ID_SYSTEM}|${chargeId}`
          : `${dedupIdentifier.system}|${dedupIdentifier.value}`,
      },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ],
  });
  const storedNotice = chargeId
    ? await mergeIntoWebhookNotice(billingOystehr, paymentNotice, desiredNotice)
    : paymentNotice;

  if (!claim) {
    // the claim may have appeared while the notice was being stored; reconcile only adds request.reference
    const lateClaim = await findBillingClaimForEncounter(billingOystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(billingOystehr, lateClaim);
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
): Promise<Stripe.PaymentIntent> => {
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
  return paymentIntent;
};

// The webhook's copy has no submitter or EHR identifier; add ours, keeping its refund stamps.
const mergeIntoWebhookNotice = async (
  billingOystehr: Oystehr,
  storedNotice: PaymentNotice,
  desiredNotice: PaymentNotice
): Promise<PaymentNotice> => {
  const [dedupIdentifier] = desiredNotice.identifier ?? [];
  const alreadyOurs = storedNotice.identifier?.some(
    (identifier) => identifier.system === dedupIdentifier?.system && identifier.value === dedupIdentifier?.value
  );
  if (alreadyOurs || !storedNotice.id) return storedNotice;

  for (let attempt = 1; ; attempt++) {
    try {
      return await billingOystehr.fhir.update<PaymentNotice>(
        {
          ...storedNotice,
          identifier: unionIdentifiers(storedNotice.identifier, desiredNotice.identifier),
          contained: desiredNotice.contained,
          extension: [
            ...(storedNotice.extension ?? []).filter((ext) => ext.url !== PAYMENT_METHOD_EXTENSION_URL),
            ...(desiredNotice.extension ?? []),
          ],
        },
        { optimisticLockingVersionId: storedNotice.meta?.versionId }
      );
    } catch (error) {
      const versionConflict = error instanceof Oystehr.OystehrFHIRError && error.code === 412;
      if (!versionConflict || attempt >= 3 || !storedNotice.id) throw error;
      storedNotice = await billingOystehr.fhir.get<PaymentNotice>({
        resourceType: 'PaymentNotice',
        id: storedNotice.id,
      });
    }
  }
};

const makePaymentNotice = (input: {
  encounterId: string;
  paymentDetails: PostBillingPatientPaymentParams['paymentDetails'];
  submitterRef: Reference;
  claim: Claim | undefined;
  identifiers: Identifier[];
  secrets: Secrets | null;
}): PaymentNotice => {
  const { encounterId, paymentDetails, submitterRef, claim, identifiers, secrets } = input;
  const { paymentMethod, amountInCents } = paymentDetails;

  // the created timestamp is in UTC and the exact date in any timezone can always be derived from there
  // for now the payment date is set to the default timezone (US Eastern)
  const now = DateTime.now();
  const created = now.toUTC().toISO();
  if (!created) {
    throw new Error('Failed to serialize the current time for PaymentNotice creation');
  }
  const paymentDate = now.setZone(TIMEZONES[0]).toFormat('yyyy-MM-dd');

  // the provider owed the money: the claim's provider when a claim exists, else the default
  // billing organization (the same default claim creation uses)
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets),
  };

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
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };
};
