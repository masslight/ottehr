import Oystehr from '@oystehr/sdk';
import { Claim, Money, PaymentNotice, PaymentReconciliation, Reference } from 'fhir/r4b';
import {
  BILLING_RECORDABLE_PAYMENT_METHODS,
  BILLING_RESOURCE_TAG,
  getSecret,
  INVALID_INPUT_ERROR,
  MANUAL_PAYMENT_CONFLICT_ERROR,
  PAYMENT_METHOD_EXTENSION_URL,
  Secrets,
  SecretsKeys,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { reconcilePaymentNoticesForClaim } from './shared';

// dedup identifier for record-billing-payment calls: value is the caller's idempotency key
export const MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM = ottehrIdentifierSystem('manual-payment-idempotency-key');
// dedup identifier for the clinical→billing bridge: value is the clinical PaymentNotice id, which
// makes task re-fires idempotent and links the billing notice back to its source
export const CLINICAL_PAYMENT_NOTICE_ID_SYSTEM = ottehrIdentifierSystem('clinical-payment-notice-id');
export const CHECK_NUMBER_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('check-number');

const PAYMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payment-type';

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

const containedReconciliation = (notice: PaymentNotice): PaymentReconciliation | undefined =>
  notice.contained?.find((r): r is PaymentReconciliation => r.resourceType === 'PaymentReconciliation');

const paymentFingerprint = (notice: PaymentNotice): string => {
  const reconciliation = containedReconciliation(notice);
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

  if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    throw INVALID_INPUT_ERROR(`amountInCents must be a positive integer, got ${amountInCents}`);
  }
  if (!(BILLING_RECORDABLE_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    throw INVALID_INPUT_ERROR(`Unrecognized payment method "${paymentMethod}"`);
  }

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
