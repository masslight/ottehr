import Oystehr from '@oystehr/sdk';
import { Identifier, Organization, PaymentNotice, Reference } from 'fhir/r4b';
import Stripe from 'stripe';
import { chunkThings } from 'utils/lib/fhir/chat';
import {
  BILLING_RESOURCE_TAG,
  PAYMENT_METHOD_EXTENSION_URL,
  PAYMENT_VOID_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getTaskResource } from 'utils/lib/fhir/helpers';
import {
  buildPaymentVoidExtension,
  isLocallyRecordedRefund,
  isPendingReservation,
  parsePaymentRefundsFromNotice,
  parsePaymentVoidFromNotice,
  upsertPaymentRefundsExtension,
} from 'utils/lib/fhir/paymentRefunds';
import {
  getContainedReconciliation,
  getPaymentNoticeSubmitterRef,
  getStripeAccountForAppointmentOrEncounter,
} from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR, parseStripeError } from 'utils/lib/types/errors';
import { shouldUseOttehrBilling } from '../shared/candid';
import { isFhirNotFoundError } from '../shared/errors';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../shared/stripeIntegration';
import { fetchPatientPaymentsByEncounterIds, fetchResourcesGrouped } from './claim-amounts';
import {
  billingProviderRefForStripeAccount,
  claimRequestFor,
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  findBillingClaimForEncounter,
  recordBillingManualRefund,
} from './payments';
import { reconcilePaymentNoticesForClaim, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from './shared';

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

// Refund and void state that only the legacy EHR notice carries. The bridge and webhook create the
// billing copy asynchronously and never copy this state, so a refund or void recorded before the copy
// existed (or whose billing-side step failed) lives on the legacy notice alone. Billing entries win on
// an id match as the newer record; legacy pending reservations belong to refund attempts that can
// no longer finish, so they are not carried over.
const withLegacyRefundAndVoidState = (billingNotice: PaymentNotice, legacyNotice: PaymentNotice): PaymentNotice => {
  const billingRefunds = parsePaymentRefundsFromNotice(billingNotice) ?? [];
  const knownRefundIds = new Set(billingRefunds.map((refund) => refund.stripeRefundId));
  const legacyOnlyRefunds = (parsePaymentRefundsFromNotice(legacyNotice) ?? []).filter(
    (refund) => !knownRefundIds.has(refund.stripeRefundId) && !isPendingReservation(refund)
  );
  const legacyVoid = legacyNotice.status === 'cancelled' ? parsePaymentVoidFromNotice(legacyNotice) : undefined;
  const voidToCarry =
    legacyVoid && billingNotice.status !== 'cancelled' && !parsePaymentVoidFromNotice(billingNotice)
      ? legacyVoid
      : undefined;
  if (legacyOnlyRefunds.length === 0 && !voidToCarry) return billingNotice;

  const withRefunds = legacyOnlyRefunds.length
    ? upsertPaymentRefundsExtension(billingNotice.extension, [...billingRefunds, ...legacyOnlyRefunds])
    : billingNotice.extension ?? [];
  return {
    ...billingNotice,
    extension: voidToCarry
      ? [...withRefunds.filter((ext) => ext.url !== PAYMENT_VOID_EXTENSION_URL), buildPaymentVoidExtension(voidToCarry)]
      : withRefunds,
    ...(voidToCarry ? { status: 'cancelled' as const } : {}),
  };
};

const withLegacyStateFrom = (billingNotice: PaymentNotice, legacyNotice: PaymentNotice): PaymentNotice =>
  withLegacyRefundAndVoidState(withSubmitterFrom(billingNotice, legacyNotice), legacyNotice);

// Patient payments (refund offset notices excluded): billing notices, carrying what the legacy EHR
// notice they shadow knows, plus the legacy notices no billing notice shadows.
export const mergeBillingAndLegacyPaymentNotices = (
  billingNotices: PaymentNotice[],
  legacyNotices: PaymentNotice[]
): PaymentNotice[] => {
  const billing = billingNotices.filter(isPositivePayment).map((billingNotice) => {
    const shadowed = legacyNotices.find((legacyNotice) => shadowsLegacyNotice(billingNotice, legacyNotice));
    return shadowed ? withLegacyStateFrom(billingNotice, shadowed) : billingNotice;
  });
  const unshadowedLegacy = legacyNotices.filter(
    (legacyNotice) => !billing.some((billingNotice) => shadowsLegacyNotice(billingNotice, legacyNotice))
  );
  return [...billing, ...unshadowedLegacy];
};

// keeps each counterpart OR list within URL limits
const COUNTERPART_BATCH_SIZE = 100;

const searchPaymentNoticesByValues = async (
  oystehr: Oystehr,
  name: string,
  values: string[]
): Promise<PaymentNotice[]> =>
  (
    await Promise.all(
      chunkThings([...new Set(values)], COUNTERPART_BATCH_SIZE).map(async (batch) => {
        const grouped = await fetchResourcesGrouped<PaymentNotice>({
          oystehr,
          resourceType: 'PaymentNotice',
          ids: batch,
          buildParam: (ids) => [{ name, value: ids.join(',') }],
          groupKeyOf: (notice) => notice.id,
          batchSize: COUNTERPART_BATCH_SIZE,
        });
        return [...grouped.values()].flat();
      })
    )
  ).flat();

/**
 * The other half of each payment recorded in both workspaces. The billing copy is timestamped by
 * the bridge or the webhook (Stripe's charge time), not when the EHR notice was written, so a
 * search filtered by created date can return one half without the other. Readers scoped to a date
 * window fetch the counterparts unfiltered, merge, then apply the window to the merged payment.
 */
export const fetchPaymentNoticeCounterparts = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  billingNotices: PaymentNotice[];
  legacyNotices: PaymentNotice[];
}): Promise<{ billing: PaymentNotice[]; legacy: PaymentNotice[] }> => {
  const { clinicalOystehr, billingOystehr, billingNotices, legacyNotices } = params;
  const bridgedLegacyIds = billingNotices
    .flatMap((notice) => notice.identifier ?? [])
    .filter((identifier) => identifier.system === CLINICAL_PAYMENT_NOTICE_ID_SYSTEM)
    .map((identifier) => identifier.value ?? '')
    .filter(Boolean);
  const stripeToken = (id: string): string => `${STRIPE_PAYMENT_ID_SYSTEM}|${id}`;

  const [legacyById, legacyByStripeId, billing] = await Promise.all([
    searchPaymentNoticesByValues(clinicalOystehr, '_id', bridgedLegacyIds),
    searchPaymentNoticesByValues(
      clinicalOystehr,
      'identifier',
      billingNotices.flatMap(stripeIdsForPaymentNotice).map(stripeToken)
    ),
    searchPaymentNoticesByValues(billingOystehr, 'identifier', [
      ...legacyNotices
        .map((notice) => notice.id)
        .filter((id): id is string => Boolean(id))
        .map((id) => `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${id}`),
      ...legacyNotices.flatMap(stripeIdsForPaymentNotice).map(stripeToken),
    ]),
  ]);
  return { billing, legacy: [...legacyById, ...legacyByStripeId] };
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

/**
 * The Stripe account each payment was taken on. A billing notice names it through its payee: every
 * writer of a Stripe payment's notice sets the payee to the billing provider carrying the account
 * (billingProviderRefForStripeAccount), so a payee carrying none means the platform account, which
 * outreach invoices are paid on. Legacy EHR notices predate that, so theirs is the account of the
 * encounter's schedule owner, as the EHR used when taking them.
 */
export const createStripeAccountResolver = (params: {
  billingOystehr: Oystehr;
  clinicalOystehr: Oystehr;
  encounterId: string;
  // the schedule owner's account when the caller already looked it up
  scheduleAccount?: Promise<string | undefined>;
}): ((notice: PaymentNotice) => Promise<string | undefined>) => {
  const { billingOystehr, clinicalOystehr, encounterId } = params;
  const accountByOrgId = new Map<string, Promise<string | undefined>>();
  let { scheduleAccount } = params;

  // a payee outside billing (the default org) is not a billing provider, so carries no account
  const accountForOrg = async (orgId: string): Promise<string | undefined> => {
    let org: Organization;
    try {
      org = await billingOystehr.fhir.get<Organization>({ resourceType: 'Organization', id: orgId });
    } catch (error) {
      if (isFhirNotFoundError(error)) return undefined;
      throw error;
    }
    return org.identifier?.find((identifier) => identifier.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)?.value;
  };

  return async (notice) => {
    if (!isBillingPaymentNotice(notice)) {
      scheduleAccount ??= getStripeAccountForAppointmentOrEncounter({ encounterId }, clinicalOystehr);
      return scheduleAccount;
    }
    const [resourceType, orgId] = notice.payee?.reference?.split('/') ?? [];
    if (resourceType !== 'Organization' || !orgId) return undefined;
    if (!accountByOrgId.has(orgId)) accountByOrgId.set(orgId, accountForOrg(orgId));
    return accountByOrgId.get(orgId);
  };
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

// The charge behind a legacy Stripe payment and the account it was taken on: the billing webhook and
// post-billing-patient-payment both key a card payment's notice on its charge id and take its payee
// from that account.
const stripeChargeForLegacyPayment = async (
  getStripe: () => Stripe,
  clinicalOystehr: Oystehr,
  paymentIntentId: string,
  encounterId: string
): Promise<{ chargeId: string | undefined; stripeAccount: string | undefined }> => {
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, clinicalOystehr);
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, undefined, { stripeAccount });
  } catch (error) {
    throw parseStripeError(error);
  }
  const chargeId =
    typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
  return { chargeId, stripeAccount };
};

// A claim created while the copy was being written may have finished linking its notices before the
// copy existed, and a retry that reuses a copy made then finds it unlinked too. Linking here, as the
// other payment writers do after storing, repairs both; the copy is re-read since the link bumps
// its version.
const linkToLateClaim = async (
  billingOystehr: Oystehr,
  notice: PaymentNotice,
  encounterId: string
): Promise<PaymentNotice> => {
  if (notice.request?.reference || !notice.id) return notice;
  const lateClaim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  if (!lateClaim) return notice;
  await reconcilePaymentNoticesForClaim(billingOystehr, lateClaim);
  return billingOystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: notice.id });
};

// Copies a legacy EHR notice (refund and void stamps included) into billing, unless a billing
// notice already records the same payment. A Stripe payment is keyed by its charge id, like the
// webhook's notice, so a later charge or refund event merges into the copy instead of recording
// the payment a second time; anything else is keyed by the legacy id. Retries reuse the copy.
const adoptLegacyPaymentNotice = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  getStripe: () => Stripe;
  legacyNotice: PaymentNotice;
  encounterId: string;
  secrets: Secrets | null;
}): Promise<PaymentNotice> => {
  const { clinicalOystehr, billingOystehr, getStripe, legacyNotice, encounterId, secrets } = params;
  if (!legacyNotice.id) throw new Error('Legacy PaymentNotice has no id');
  const stripePaymentIntentId = stripePaymentIntentIdForNotice(legacyNotice);
  const stripeCharge = stripePaymentIntentId
    ? await stripeChargeForLegacyPayment(getStripe, clinicalOystehr, stripePaymentIntentId, encounterId)
    : undefined;
  const chargeId = stripeCharge?.chargeId;
  const identifierValues = [
    `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${legacyNotice.id}`,
    ...[stripePaymentIntentId, chargeId]
      .filter((id): id is string => Boolean(id))
      .map((id) => `${STRIPE_PAYMENT_ID_SYSTEM}|${id}`),
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
  if (existing[0]) return linkToLateClaim(billingOystehr, existing[0], encounterId);

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  const payeeRef: Reference = stripeCharge
    ? await billingProviderRefForStripeAccount(billingOystehr, stripeCharge.stripeAccount, secrets)
    : claim?.provider ?? { reference: getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets) };
  const { id: legacyId, meta: _meta, ...legacyFields } = legacyNotice;
  const dedupIdentifier: Identifier = chargeId
    ? { system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId }
    : { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: legacyId };
  const adopted = await billingOystehr.fhir.create<PaymentNotice>(
    {
      ...legacyFields,
      request: claimRequestFor(claim, encounterId),
      payee: payeeRef,
      recipient: payeeRef,
      identifier: unionIdentifiers(legacyNotice.identifier, [
        { system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: legacyId },
        ...(chargeId ? [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: chargeId }] : []),
      ]),
    },
    {
      ifNoneExist: [
        { name: 'identifier', value: `${dedupIdentifier.system}|${dedupIdentifier.value}` },
        { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      ],
    }
  );
  return linkToLateClaim(billingOystehr, adopted, encounterId);
};

// the legacy EHR notice a billing notice was copied from, or that records the same Stripe payment
const findLegacyCounterpart = async (
  clinicalOystehr: Oystehr,
  billingNotice: PaymentNotice,
  encounterId: string
): Promise<PaymentNotice | undefined> => {
  const legacyId = billingNotice.identifier?.find(
    (identifier) => identifier.system === CLINICAL_PAYMENT_NOTICE_ID_SYSTEM
  )?.value;
  if (legacyId) return getPaymentNoticeIfVisible(clinicalOystehr, legacyId);

  const stripeIds = stripeIdsForPaymentNotice(billingNotice);
  if (stripeIds.length === 0) return undefined;
  return (
    await clinicalOystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        { name: 'request', value: `Encounter/${encounterId}` },
        { name: 'identifier', value: stripeIds.map((id) => `${STRIPE_PAYMENT_ID_SYSTEM}|${id}`).join(',') },
      ],
    })
  ).unbundle()[0];
};

// Persists legacy-only refund and void state onto the billing notice before a write validates
// against it. Version guarded, so a concurrent writer fails this request instead of being overwritten.
const persistLegacyState = async (
  billingOystehr: Oystehr,
  billingNotice: PaymentNotice,
  legacyNotice: PaymentNotice | undefined
): Promise<PaymentNotice> => {
  const synced = legacyNotice ? withLegacyRefundAndVoidState(billingNotice, legacyNotice) : billingNotice;
  if (synced === billingNotice || !billingNotice.id) return billingNotice;
  return billingOystehr.fhir.patch<PaymentNotice>({
    resourceType: 'PaymentNotice',
    id: billingNotice.id,
    operations: [
      ...(billingNotice.meta?.versionId
        ? [{ op: 'test' as const, path: '/meta/versionId', value: billingNotice.meta.versionId }]
        : []),
      ...(synced.status !== billingNotice.status
        ? [{ op: 'replace' as const, path: '/status', value: synced.status }]
        : []),
      {
        op: billingNotice.extension !== undefined ? ('replace' as const) : ('add' as const),
        path: '/extension',
        value: synced.extension,
      },
    ],
  });
};

/**
 * The billing notice a refund or void writes to. `paymentNoticeId` comes from the payments list,
 * so it is either a billing notice or a legacy EHR notice, which gets adopted into billing. Either
 * way the result carries the legacy notice's refund and void state.
 */
/**
 * Billing AR subtracts a refund only through its negative offset notice; the refund stamp on the
 * payment notice is not counted. Stripe refunds get theirs from the billing webhook, refunds recorded
 * locally (cash, check, external) from whoever records them, and an offset is missing when the
 * refund was recorded before billing was on or that step failed. Re-recording every local refund on
 * the notice repairs that; the writer dedups on the refund id, so a write that finds all offsets
 * in place changes nothing.
 */
export const recordLocalRefundOffsets = async (
  billingOystehr: Oystehr,
  notice: PaymentNotice,
  encounterId: string,
  secrets: Secrets,
  refunds = parsePaymentRefundsFromNotice(notice) ?? []
): Promise<void> => {
  if (!shouldUseOttehrBilling(secrets)) return;
  for (const refund of refunds) {
    if (!isLocallyRecordedRefund(refund) || isPendingReservation(refund)) continue;
    // external refunds carry the return medium; manual refunds use the payment's own method
    const paymentMethod = refund.medium ?? paymentMethodForNotice(notice);
    if (!paymentMethod) continue;
    await recordBillingManualRefund(billingOystehr, {
      encounterId,
      refundId: refund.stripeRefundId,
      amountInCents: refund.amountInCents,
      paymentMethod,
      createdISO: refund.dateISO,
      reason: refund.reason ?? 'Other',
      secrets,
    });
  }
};

// Resolves the billing notice to refund or void, adopting a legacy one first. Refund state is
// reconciled before the caller validates, so billing balances already reflect earlier refunds even
// when validation then rejects the request.
export const resolvePaymentNoticeForWrite = async (params: {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  // resolves the charge behind a legacy Stripe payment when it is adopted; only called then
  getStripe: () => Stripe;
  paymentNoticeId: string;
  encounterId: string;
  secrets: Secrets;
}): Promise<PaymentNotice> => {
  const { clinicalOystehr, billingOystehr, getStripe, paymentNoticeId, encounterId, secrets } = params;

  const billingNotice = await getPaymentNoticeIfVisible(billingOystehr, paymentNoticeId);
  if (billingNotice) {
    if (!isPositivePayment(billingNotice)) {
      throw INVALID_INPUT_ERROR('Only positive payment notices can be refunded or voided.');
    }
    assertNoticeBelongsToEncounter(billingNotice, encounterId);
    const legacyNotice = await findLegacyCounterpart(clinicalOystehr, billingNotice, encounterId);
    const resolved = await persistLegacyState(billingOystehr, billingNotice, legacyNotice);
    await recordLocalRefundOffsets(billingOystehr, resolved, encounterId, secrets);
    return resolved;
  }

  const legacyNotice = await getPaymentNoticeIfVisible(clinicalOystehr, paymentNoticeId);
  if (!legacyNotice) {
    throw FHIR_RESOURCE_NOT_FOUND('PaymentNotice');
  }
  assertNoticeBelongsToEncounter(legacyNotice, encounterId);
  const adopted = await adoptLegacyPaymentNotice({
    clinicalOystehr,
    billingOystehr,
    getStripe,
    legacyNotice,
    encounterId,
    secrets,
  });
  const resolved = await persistLegacyState(billingOystehr, adopted, legacyNotice);
  await recordLocalRefundOffsets(billingOystehr, resolved, encounterId, secrets);
  return resolved;
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
}): Promise<PaymentNotice | undefined> => {
  const { clinicalOystehr, billingOystehr, paymentNoticeId } = params;
  const billingNotice = await getPaymentNoticeIfVisible(billingOystehr, paymentNoticeId);
  if (billingNotice) return billingNotice;

  const legacyNotice = await getPaymentNoticeIfVisible(clinicalOystehr, paymentNoticeId);
  if (!legacyNotice) return undefined;

  const counterparts = await fetchPaymentNoticeCounterparts({
    clinicalOystehr,
    billingOystehr,
    billingNotices: [],
    legacyNotices: [legacyNotice],
  });
  return mergeBillingAndLegacyPaymentNotices(counterparts.billing, [legacyNotice])[0];
};
