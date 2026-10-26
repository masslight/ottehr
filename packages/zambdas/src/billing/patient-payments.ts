import Oystehr from '@oystehr/sdk';
import { Identifier, PaymentNotice, Reference } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getTaskResource } from 'utils/lib/fhir/helpers';
import { getContainedReconciliation, getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { isFhirNotFoundError } from '../shared/errors';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../shared/stripeIntegration';
import { fetchPatientPaymentsByEncounterIds, fetchResourcesGrouped } from './claim-amounts';
import { claimRequestFor, CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, findBillingClaimForEncounter } from './payments';

// Patient payments are owned by the billing app: new ones are billing-tagged PaymentNotices whose
// request points at the encounter's claim. Notices the EHR wrote before the move are untagged,
// reference the Encounter directly and stay as they are, so readers merge both and writers adopt
// a legacy notice into billing before changing it.

// refunds and voids move money back or erase a record, so only billing admins may issue them
export const PAYMENT_MANAGEMENT_ROLES = [RoleType.BillingAdmin];

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
const PAYMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payment-type';
// stripe object id prefixes that are not payment intents (charges, refunds, invoices, payments)
const NON_PAYMENT_INTENT_STRIPE_ID = /^(ch|py|re|in)_/;

export const isBillingPaymentNotice = (notice: PaymentNotice): boolean =>
  notice.meta?.tag?.some(
    (tag) => tag.system === BILLING_RESOURCE_TAG.system && tag.code === BILLING_RESOURCE_TAG.code
  ) ?? false;

export const encounterIdForPaymentNotice = (notice: PaymentNotice): string | undefined => {
  const reference = notice.request?.reference;
  if (reference?.startsWith('Encounter/')) return reference.slice('Encounter/'.length);
  const identifier = notice.request?.identifier;
  return identifier?.system === CLAIM_ENCOUNTER_ID_SYSTEM ? identifier.value : undefined;
};

export const stripeIdsForPaymentNotice = (notice: PaymentNotice): string[] =>
  (notice.identifier ?? [])
    .filter((identifier) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM)
    .map((identifier) => identifier.value ?? '')
    .filter(Boolean);

// the webhook stores the charge id next to the payment intent id, EHR-written notices only the latter
export const stripePaymentIntentIdForNotice = (notice: PaymentNotice): string | undefined => {
  const ids = stripeIdsForPaymentNotice(notice);
  return ids.find((id) => id.startsWith('pi_')) ?? ids.find((id) => !NON_PAYMENT_INTENT_STRIPE_ID.test(id));
};

// the webhook records the Stripe method type, where the EHR records 'card-reader' for terminal payments
export const paymentMethodForNotice = (notice: PaymentNotice): string | undefined => {
  const method = notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString;
  return method === 'card_present' ? 'card-reader' : method;
};

const isPositivePayment = (notice: PaymentNotice): boolean => (notice.amount?.value ?? 0) > 0;

export const unionIdentifiers = (existing: Identifier[] = [], added: Identifier[] = []): Identifier[] => [
  ...existing,
  ...added.filter((identifier) =>
    existing.every((known) => known.system !== identifier.system || known.value !== identifier.value)
  ),
];

// a billing notice shadows the legacy notice it was copied from (cash/check bridge) or that records
// the same Stripe payment (webhook)
const shadowsLegacyNotice = (billingNotice: PaymentNotice, legacyNotice: PaymentNotice): boolean => {
  const bridged = billingNotice.identifier?.some(
    (identifier) => identifier.system === CLINICAL_PAYMENT_NOTICE_ID_SYSTEM && identifier.value === legacyNotice.id
  );
  if (bridged) return true;
  const billingStripeIds = stripeIdsForPaymentNotice(billingNotice);
  return stripeIdsForPaymentNotice(legacyNotice).some((id) => billingStripeIds.includes(id));
};

// webhook copies carry no submitter, the EHR notice they shadow does
const withSubmitterFrom = (billingNotice: PaymentNotice, legacyNotice: PaymentNotice): PaymentNotice => {
  const submitter = getPaymentNoticeSubmitterRef(legacyNotice);
  const reconciliation = getContainedReconciliation(billingNotice);
  if (!submitter || !reconciliation || getPaymentNoticeSubmitterRef(billingNotice)) return billingNotice;
  return {
    ...billingNotice,
    contained: billingNotice.contained?.map((resource) =>
      resource === reconciliation
        ? {
            ...reconciliation,
            detail: [
              ...(reconciliation.detail ?? []),
              { type: { coding: [{ system: PAYMENT_TYPE_SYSTEM, code: 'payment' }] }, submitter },
            ],
          }
        : resource
    ),
  };
};

// Patient payments (refund offset notices excluded): billing notices plus the legacy EHR notices
// no billing notice shadows.
export const mergeBillingAndLegacyPaymentNotices = (
  billingNotices: PaymentNotice[],
  legacyNotices: PaymentNotice[]
): PaymentNotice[] => {
  const billing = billingNotices.filter(isPositivePayment).map((billingNotice) => {
    const shadowed = legacyNotices.find((legacyNotice) => shadowsLegacyNotice(billingNotice, legacyNotice));
    return shadowed ? withSubmitterFrom(billingNotice, shadowed) : billingNotice;
  });
  const unshadowedLegacy = legacyNotices.filter(
    (legacyNotice) => !billing.some((billingNotice) => shadowsLegacyNotice(billingNotice, legacyNotice))
  );
  return [...billing, ...unshadowedLegacy];
};

// Patient payments for each encounter, keyed by encounter id.
export const fetchEncounterPaymentNotices = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  encounterIds: string[];
}): Promise<Map<string, PaymentNotice[]>> => {
  const { clinicalOystehr, billingOystehr, encounterIds } = params;
  const [billingByEncounter, legacyByEncounter] = await Promise.all([
    fetchPatientPaymentsByEncounterIds(billingOystehr, encounterIds),
    fetchResourcesGrouped<PaymentNotice>({
      oystehr: clinicalOystehr,
      resourceType: 'PaymentNotice',
      ids: encounterIds,
      buildParam: (batch) => [{ name: 'request', value: batch.map((id) => `Encounter/${id}`).join(',') }],
      groupKeyOf: encounterIdForPaymentNotice,
    }),
  ]);

  return new Map(
    [...new Set(encounterIds)].map((encounterId) => [
      encounterId,
      mergeBillingAndLegacyPaymentNotices(
        billingByEncounter.get(encounterId) ?? [],
        legacyByEncounter.get(encounterId) ?? []
      ),
    ])
  );
};

const getPaymentNoticeIfVisible = async (oystehr: Oystehr, id: string): Promise<PaymentNotice | undefined> => {
  try {
    return await oystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id });
  } catch (error) {
    if (isFhirNotFoundError(error)) return undefined;
    throw error;
  }
};

const assertNoticeBelongsToEncounter = (notice: PaymentNotice, encounterId: string): void => {
  if (encounterIdForPaymentNotice(notice) !== encounterId) {
    throw INVALID_INPUT_ERROR('PaymentNotice does not belong to the specified encounter.');
  }
};

// Copies a legacy EHR notice (refund and void stamps included) into billing, unless a billing
// notice already records the same payment. Keyed by the legacy id, so retries reuse the copy.
const adoptLegacyPaymentNotice = async (
  billingOystehr: Oystehr,
  legacyNotice: PaymentNotice,
  encounterId: string,
  secrets: Secrets | null
): Promise<PaymentNotice> => {
  if (!legacyNotice.id) throw new Error('Legacy PaymentNotice has no id');
  const stripePaymentIntentId = stripePaymentIntentIdForNotice(legacyNotice);
  const identifierValues = [
    `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${legacyNotice.id}`,
    ...(stripePaymentIntentId ? [`${STRIPE_PAYMENT_ID_SYSTEM}|${stripePaymentIntentId}`] : []),
  ].join(',');
  const existing = (
    await billingOystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'identifier', value: identifierValues }],
    })
  )
    .unbundle()
    .filter(isPositivePayment);
  if (existing.length > 1) {
    throw new Error(`Found ${existing.length} billing PaymentNotices for PaymentNotice/${legacyNotice.id}`);
  }
  if (existing[0]) return existing[0];

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  const payeeRef: Reference = claim?.provider ?? {
    reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets),
  };
  const { id: legacyId, meta: _meta, ...legacyFields } = legacyNotice;
  return billingOystehr.fhir.create<PaymentNotice>(
    {
      ...legacyFields,
      request: claimRequestFor(claim, encounterId),
      payee: payeeRef,
      recipient: payeeRef,
      identifier: [...(legacyNotice.identifier ?? []), { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: legacyId }],
    },
    {
      ifNoneExist: [
        { name: 'identifier', value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${legacyId}` },
        { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      ],
    }
  );
};

/**
 * The billing notice a refund or void writes to. `paymentNoticeId` comes from the payments list,
 * so it is either a billing notice or a legacy EHR notice, which gets adopted into billing.
 */
export const resolvePaymentNoticeForWrite = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  paymentNoticeId: string;
  encounterId: string;
  secrets: Secrets | null;
}): Promise<PaymentNotice> => {
  const { clinicalOystehr, billingOystehr, paymentNoticeId, encounterId, secrets } = params;

  const billingNotice = await getPaymentNoticeIfVisible(billingOystehr, paymentNoticeId);
  if (billingNotice) {
    assertNoticeBelongsToEncounter(billingNotice, encounterId);
    return billingNotice;
  }

  const legacyNotice = await getPaymentNoticeIfVisible(clinicalOystehr, paymentNoticeId);
  if (!legacyNotice) {
    throw FHIR_RESOURCE_NOT_FOUND('PaymentNotice');
  }
  assertNoticeBelongsToEncounter(legacyNotice, encounterId);
  return adoptLegacyPaymentNotice(billingOystehr, legacyNotice, encounterId, secrets);
};

// The Candid-sync / receipt Task is a clinical work item, so it is written with the clinical client
// and points at the billing notice. The conditional create on focus + code makes it safe to call
// on an idempotent replay: the subscription only completes Tasks, so a finished one still blocks
// a duplicate, while a missing one (a previous attempt died before creating it) is created.
export const ensurePaymentTaskForNotice = async (
  clinicalOystehr: Oystehr,
  paymentNotice: PaymentNotice,
  encounterId: string
): Promise<void> => {
  if (!paymentNotice.id) {
    throw new Error('PaymentNotice ID is required to create task');
  }
  const { system, code } = TaskIndicator.patientPaymentCandidSyncAndReceipt;
  const amountInDollars = paymentNotice.amount?.value ?? 0;

  const paymentTaskResource = getTaskResource(
    TaskIndicator.patientPaymentCandidSyncAndReceipt,
    `Payment notice for $${amountInDollars.toFixed(2)}`,
    paymentNotice.id,
    encounterId
  );
  paymentTaskResource.focus = {
    type: 'PaymentNotice',
    reference: `PaymentNotice/${paymentNotice.id}`,
  };
  await clinicalOystehr.fhir.create(paymentTaskResource, {
    ifNoneExist: [
      { name: 'focus', value: `PaymentNotice/${paymentNotice.id}` },
      { name: 'code', value: `${system}|${code}` },
    ],
  });
};

// Loads the notice a payment Task points at: a billing notice, or a legacy EHR notice for Tasks
// the terminal flow still creates.
export const getPaymentNoticeForTask = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  paymentNoticeId: string;
}): Promise<PaymentNotice | undefined> =>
  (await getPaymentNoticeIfVisible(params.billingOystehr, params.paymentNoticeId)) ??
  (await getPaymentNoticeIfVisible(params.clinicalOystehr, params.paymentNoticeId));
