import Oystehr from '@oystehr/sdk';
import { Claim, Money, Organization, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { BILLING_RECORDABLE_PAYMENT_METHODS } from 'utils/lib/types/data/billing/billing.constants';
import { MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../shared/stripeIntegration';
import { safeValidate } from '../shared/validation';
import { reconcilePaymentNoticesForClaim, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from './shared';

// dedup identifier for record-billing-manual-payment calls: value is the caller's idempotency key
export const MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('manual-payment-idempotency-key');
// dedup identifier for the clinical→billing bridge: value is the clinical PaymentNotice id, which
// makes task re-fires idempotent and links the billing notice back to its source
export const CLINICAL_PAYMENT_NOTICE_ID_SYSTEM = ottehrIdentifierSystem('clinical-payment-notice-id');
export const CHECK_NUMBER_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('check-number');
// dedup identifier for post-billing-patient-payment calls: value is `<encounterId>_<idempotency key>`,
// scoped to the encounter because the key is client supplied
export const EHR_PATIENT_PAYMENT_ID_SYSTEM = ottehrIdentifierSystem('ehr-patient-payment-id');

const PAYMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payment-type';

// the bridge bypasses the endpoint's input schema, so the writer re-checks the money fields itself
const RecordablePaymentSchema = z.object({
  amountInCents: z.number().int().positive(),
  paymentMethod: z.enum(BILLING_RECORDABLE_PAYMENT_METHODS),
});

// dedup identifier for manual (non-processor) refunds recorded from the EHR
export const MANUAL_REFUND_ID_SYSTEM = ottehrIdentifierSystem('manual-refund-id');

// identifier filter (`system|` matches any value) selecting patient payment and refund notices,
// which keeps write-offs and other billing PaymentNotices out
export const PATIENT_PAYMENT_IDENTIFIER_FILTER = [
  MANUAL_REFUND_ID_SYSTEM,
  STRIPE_PAYMENT_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  EHR_PATIENT_PAYMENT_ID_SYSTEM,
]
  .map((system) => `${system}|`)
  .join(',');

// Mirrors the stripe webhook's negative refund notice so patient AR stays a plain sum over a
// claim's notices; used for cash/check/external-reader refunds, which have no processor events.
export const recordBillingManualRefund = async (
  oystehr: Oystehr,
  input: {
    encounterId: string;
    refundId: string;
    amountInCents: number;
    paymentMethod: string;
    createdISO: string;
    reason: string;
    secrets: Secrets | null;
  }
): Promise<void> => {
  const { encounterId, refundId, amountInCents, paymentMethod, createdISO, reason, secrets } = input;

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets),
  };

  const amount: Money = { value: -(amountInCents / 100), currency: 'USD' };
  const reconciliation: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'contained-reconciliation',
    status: 'active',
    created: createdISO,
    disposition: `Manual ${paymentMethod} refund (${reason})`,
    outcome: 'complete',
    paymentDate: createdISO.slice(0, 10),
    paymentAmount: amount,
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created: createdISO,
    paymentDate: createdISO.slice(0, 10),
    amount,
    identifier: [{ system: MANUAL_REFUND_ID_SYSTEM, value: refundId }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };

  await oystehr.fhir.create<PaymentNotice>(desiredNotice, {
    ifNoneExist: [
      { name: 'identifier', value: `${MANUAL_REFUND_ID_SYSTEM}|${refundId}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ],
  });

  if (!claim) {
    // the claim may have appeared while the notice was being stored; reconcile only adds request.reference
    const lateClaim = await findBillingClaimForEncounter(oystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(oystehr, lateClaim);
    }
  }
};

// The payee of a payment taken through Stripe: the billing provider org stamped with the connected
// account id, or the default org otherwise. Every writer of a Stripe payment's notice uses this, so
// the payee does not depend on which one stores it first. Providers sharing an account share a TIN,
// so the first match is fine.
export const billingProviderRefForStripeAccount = async (
  oystehr: Oystehr,
  stripeAccount: string | undefined,
  secrets: Secrets | null
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

export const findBillingClaimForEncounter = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<Claim | undefined> => {
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

// before the claim exists this is a logical reference only, reconciled once the claim is created
export const claimRequestFor = (claim: Claim | undefined, encounterId: string): Reference => ({
  type: 'Claim',
  identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId },
  ...(claim?.id ? { reference: `Claim/${claim.id}` } : {}),
});

export interface RecordBillingPatientPaymentInput {
  encounterId: string;
  amountInCents: number;
  // string rather than the manual-methods enum: the bridge forwards clinical method strings
  paymentMethod: string;
  dedupIdentifier: { system: string; value: string };
  secrets: Secrets | null;
  paymentDate: string;
  createdISO: string;
  checkNumber?: string;
  description?: string;
  submitterRef?: Reference;
}

const paymentFingerprint = (notice: PaymentNotice): string => {
  const reconciliation = getContainedReconciliation(notice);
  return JSON.stringify({
    amount: notice.amount?.value,
    currency: notice.amount?.currency,
    method: notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString,
    encounterId: notice.request?.identifier?.value,
    paymentDate: notice.paymentDate,
    checkNumber: reconciliation?.paymentIdentifier?.value,
    description: reconciliation?.disposition,
  });
};

// Documents a payment collected outside any integrated processor (cash, check, ...) as a
// billing-tagged PaymentNotice, mirroring the stripe webhook's shape. Recorded payments are
// immutable, which is why the webhook's upsert (it refreshes notices on charge.updated) is not
// reused here.
export const recordBillingPatientPayment = async (
  oystehr: Oystehr,
  input: RecordBillingPatientPaymentInput
): Promise<{ notice: PaymentNotice; claimId?: string }> => {
  const {
    encounterId,
    amountInCents,
    paymentMethod,
    dedupIdentifier,
    secrets,
    paymentDate,
    createdISO,
    checkNumber,
    description,
    submitterRef,
  } = input;

  safeValidate(RecordablePaymentSchema, { amountInCents, paymentMethod });

  const claim = await findBillingClaimForEncounter(oystehr, encounterId);

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
    created: createdISO,
    disposition: description ?? `${paymentMethod} payment collected manually`,
    outcome: 'complete',
    paymentDate,
    paymentAmount,
    ...(checkNumber ? { paymentIdentifier: { system: CHECK_NUMBER_IDENTIFIER_SYSTEM, value: checkNumber } } : {}),
    ...(submitterRef
      ? {
          detail: [
            {
              type: { coding: [{ system: PAYMENT_TYPE_SYSTEM, code: 'payment' }] },
              submitter: submitterRef,
            },
          ],
        }
      : {}),
  };

  const desiredNotice: PaymentNotice = {
    resourceType: 'PaymentNotice',
    status: 'active',
    request: claimRequestFor(claim, encounterId),
    created: createdISO,
    paymentDate,
    amount: paymentAmount,
    identifier: [{ system: dedupIdentifier.system, value: dedupIdentifier.value }],
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: paymentMethod }],
    contained: [reconciliation],
    payment: { reference: `#${reconciliation.id}` },
    payee: payeeRef,
    recipient: payeeRef,
  };

  const returned = await oystehr.fhir.create<PaymentNotice>(desiredNotice, {
    ifNoneExist: [
      { name: 'identifier', value: `${dedupIdentifier.system}|${dedupIdentifier.value}` },
      { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
    ],
  });

  if (paymentFingerprint(returned) !== paymentFingerprint(desiredNotice)) {
    throw MANUAL_PAYMENT_CONFLICT_ERROR(dedupIdentifier.value);
  }

  const referencedClaimId = returned.request?.reference?.startsWith('Claim/')
    ? returned.request.reference.slice('Claim/'.length)
    : undefined;
  let claimId = claim?.id ?? referencedClaimId;
  if (!claimId) {
    // the claim may have appeared while the notice was being stored; reconcile only adds request.reference
    const lateClaim = await findBillingClaimForEncounter(oystehr, encounterId);
    if (lateClaim) {
      await reconcilePaymentNoticesForClaim(oystehr, lateClaim);
      claimId = lateClaim.id;
    }
  }

  return { notice: returned, claimId };
};
