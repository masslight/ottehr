import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  isLocallyRecordedRefund,
  isPendingReservation,
  mergeStripeRefundsWithStored,
  parsePaymentRefundsFromNotice,
  PENDING_RESERVATION_PREFIX,
  pendingReservationTotalInCents,
  settledRefundTotalInCents,
  staleReservationIds,
} from 'utils/lib/fhir/paymentRefunds';
import { getOrCreateCandidApiClient } from 'utils/lib/helpers/candidApi';
import { Secrets } from 'utils/lib/secrets';
import {
  PaymentRefundDTO,
  RefundPatientPaymentInput,
  RefundPatientPaymentResponse,
} from 'utils/lib/types/api/patient-payment-types';
import { RefundBillingPatientPaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR, parseStripeError } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../shared/auth';
import { shouldUseCandid, syncCandidPatientRefunds } from '../../shared/candid';
// eslint-disable-next-line no-restricted-imports -- reads legacy clinical payment notices, the Stripe account and Candid client, and syncs refunds to Candid
import { createClinicalOystehrClient } from '../../shared/helpers';
import { practitionerRefForUser } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { applyRefundsToPaymentNotice, getStripeClient, stripeRefundToDTO } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import {
  createStripeAccountResolver,
  PAYMENT_MANAGEMENT_ROLES,
  paymentMethodForNotice,
  recordLocalRefundOffsets,
  resolvePaymentNoticeForWrite,
  stripePaymentIntentIdForNotice,
} from '../patient-payments';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'refund-billing-patient-payment';

// no processor link in these flows, so their refunds are recorded in FHIR only
const MANUAL_REFUNDABLE_PAYMENT_METHODS = ['cash', 'check', 'external-card-reader'];

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...validatedParameters } = validateWithSchema(RefundBillingPatientPaymentInputSchema, input);

  const user = await requireUserWithRole(getUserToken(input), secrets, PAYMENT_MANAGEMENT_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, secrets);
  const billingOystehr = createBillingClient(m2mToken, secrets);
  const stripeClient = getStripeClient(secrets);

  const notice = await resolvePaymentNoticeForWrite({
    clinicalOystehr,
    billingOystehr,
    getStripe: () => stripeClient,
    paymentNoticeId: validatedParameters.paymentNoticeId,
    encounterId: validatedParameters.encounterId,
    secrets,
  });

  // the account the payment was taken on, which is not the schedule's for an outreach invoice; a
  // payment outside Stripe has none, and its encounter need not have a schedule to fall back on
  const stripeAccount = stripePaymentIntentIdForNotice(notice)
    ? await createStripeAccountResolver({
        billingOystehr,
        clinicalOystehr,
        encounterId: validatedParameters.encounterId,
      })(notice)
    : undefined;
  const effectInput = await complexValidation(validatedParameters, notice, stripeAccount, stripeClient);

  const refundedBy = (await practitionerRefForUser(user, clinicalOystehr)).display;

  const response = await performEffect(
    { ...effectInput, refundedBy },
    { clinicalOystehr, billingOystehr, secrets },
    stripeClient
  );
  return { statusCode: 200, body: JSON.stringify(response) };
});

interface RefundContext {
  clinicalOystehr: Oystehr;
  billingOystehr: Oystehr;
  secrets: Secrets;
}

interface RefundEffectInput {
  // the billing notice; a legacy EHR notice has already been adopted into billing
  notice: PaymentNotice;
  encounterId: string;
  // absent for manual (cash/check/external-reader) refunds, which never touch Stripe
  stripePaymentId?: string;
  paymentMethod?: string;
  stripeAccount: string | undefined;
  existingRefunds: PaymentRefundDTO[];
  refundAmountInCents: number;
  reason: RefundPatientPaymentInput['reason'];
  notes?: string;
  refundedBy?: string;
  // record-only refund issued outside Stripe for a Stripe-linked payment
  external?: boolean;
  medium?: RefundPatientPaymentInput['medium'];
  // stable across retries so a re-run resumes this refund instead of recording a second one
  manualRefundId: string;
  // client key namespaced by paymentNoticeId, since derived ids/dedup identifiers are global
  operationKey?: string;
  // set when the refund was already stamped by a previous attempt; effects re-run idempotently
  resumeRefund?: PaymentRefundDTO;
  // this request's balance reservation id (Stripe-linked payments only)
  pendingReservationId?: string;
  // abandoned reservations to drop on the next successful stamp
  expiredReservationIds?: string[];
}

const complexValidation = async (
  params: RefundPatientPaymentInput,
  notice: PaymentNotice,
  stripeAccount: string | undefined,
  stripeClient: Stripe
): Promise<RefundEffectInput> => {
  const {
    encounterId,
    paymentNoticeId,
    reason,
    notes,
    amountInCents: requestedAmountInCents,
    external,
    medium,
    idempotencyKey,
  } = params;

  // scope the client key to this payment: derived refund ids and billing dedup identifiers are
  // global, so a key reused on another payment must not collide (mirrors post-billing-patient-payment)
  const operationKey = idempotencyKey ? `${paymentNoticeId}_${idempotencyKey}` : undefined;
  const manualRefundId = `manual_${operationKey ?? randomUUID()}`;

  const stripePaymentId = stripePaymentIntentIdForNotice(notice);
  if (notice.status === 'cancelled') {
    throw INVALID_INPUT_ERROR('This payment has been voided.');
  }

  if (!stripePaymentId) {
    if (external) {
      throw INVALID_INPUT_ERROR(
        'External refunds only apply to Stripe-linked payments; this payment is already recorded manually.'
      );
    }
    const paymentMethod = paymentMethodForNotice(notice);
    if (!paymentMethod || !MANUAL_REFUNDABLE_PAYMENT_METHODS.includes(paymentMethod)) {
      throw INVALID_INPUT_ERROR('This payment is not linked to a Stripe payment and cannot be refunded.');
    }

    const existingRefunds = parsePaymentRefundsFromNotice(notice) ?? [];
    const resumeRefund = existingRefunds.find((refund) => refund.stripeRefundId === manualRefundId);
    if (resumeRefund) {
      return {
        notice,
        encounterId,
        paymentMethod,
        stripeAccount: undefined,
        existingRefunds,
        refundAmountInCents: resumeRefund.amountInCents,
        reason,
        notes,
        manualRefundId,
        operationKey,
        resumeRefund,
      };
    }

    const amountInCents = Math.round((notice.amount?.value ?? 0) * 100);
    const remainingInCents = amountInCents - settledRefundTotalInCents(existingRefunds);
    if (remainingInCents <= 0) {
      throw INVALID_INPUT_ERROR('This payment has already been fully refunded.');
    }

    const refundAmountInCents = requestedAmountInCents ?? remainingInCents;
    if (refundAmountInCents > remainingInCents) {
      throw INVALID_INPUT_ERROR(
        `Refund amount exceeds the remaining refundable amount of ${(remainingInCents / 100).toFixed(2)}.`
      );
    }

    return {
      notice,
      encounterId,
      paymentMethod,
      stripeAccount: undefined,
      existingRefunds,
      refundAmountInCents,
      reason,
      notes,
      manualRefundId,
      operationKey,
    };
  }

  const pendingReservationId = `${PENDING_RESERVATION_PREFIX}${operationKey ?? randomUUID()}`;
  let existingRefunds: PaymentRefundDTO[];
  let expiredReservationIds: string[];
  let stripeResumeRefund: PaymentRefundDTO | undefined;
  try {
    const stripeRefundList = (
      await stripeClient.refunds.list({ payment_intent: stripePaymentId, limit: 100 }, { stripeAccount })
    ).data;
    // a retry after Stripe created the refund but stamping failed finds it by its operation key
    const priorRefund = operationKey
      ? stripeRefundList.find((refund) => refund.metadata?.operationKey === operationKey)
      : undefined;
    stripeResumeRefund = priorRefund ? stripeRefundToDTO(priorRefund) : undefined;
    // externally recorded refunds live only in FHIR but still reduce what remains refundable
    const merged = mergeStripeRefundsWithStored(
      parsePaymentRefundsFromNotice(notice),
      stripeRefundList.map(stripeRefundToDTO)
    );
    expiredReservationIds = staleReservationIds(merged).filter((id) => id !== pendingReservationId);
    // our own (re-claimed) reservation and stale ones don't count against the balance
    existingRefunds = merged.filter(
      (refund) =>
        refund.stripeRefundId !== pendingReservationId && !expiredReservationIds.includes(refund.stripeRefundId)
    );
  } catch (error: unknown) {
    console.error('Stripe refund lookup failed', error);
    throw parseStripeError(error);
  }

  const amountInCents = Math.round((notice.amount?.value ?? 0) * 100);
  // the same operation key must not execute both refund modes: a replay that switched
  // external on/off would record a second refund instead of resuming the first
  const manualResumeRefund = existingRefunds.find((refund) => refund.stripeRefundId === manualRefundId);
  if (external && stripeResumeRefund) {
    throw INVALID_INPUT_ERROR(
      'This operation already issued a Stripe refund; it cannot be replayed as an external refund.'
    );
  }
  if (!external && manualResumeRefund) {
    throw INVALID_INPUT_ERROR(
      'This operation already recorded an external refund; it cannot be replayed as a Stripe refund.'
    );
  }
  const resumeRefund = external ? manualResumeRefund : stripeResumeRefund;
  if (resumeRefund) {
    return {
      notice,
      encounterId,
      stripePaymentId,
      stripeAccount,
      existingRefunds,
      refundAmountInCents: resumeRefund.amountInCents,
      reason,
      notes,
      external,
      medium,
      manualRefundId,
      operationKey,
      resumeRefund,
      pendingReservationId,
      expiredReservationIds,
    };
  }

  // live reservations still hold balance even though they're excluded from settled totals
  const remainingInCents =
    amountInCents - settledRefundTotalInCents(existingRefunds) - pendingReservationTotalInCents(existingRefunds);
  if (remainingInCents <= 0) {
    throw INVALID_INPUT_ERROR('This payment has already been fully refunded.');
  }

  const refundAmountInCents = requestedAmountInCents ?? remainingInCents;
  if (refundAmountInCents > remainingInCents) {
    throw INVALID_INPUT_ERROR(
      `Refund amount exceeds the remaining refundable amount of ${(remainingInCents / 100).toFixed(2)}.`
    );
  }

  return {
    notice,
    encounterId,
    stripePaymentId,
    stripeAccount,
    existingRefunds,
    refundAmountInCents,
    reason,
    notes,
    external,
    medium,
    manualRefundId,
    operationKey,
    pendingReservationId,
    expiredReservationIds,
  };
};

// FHIR-only refunds have no processor events, so the negative AR offsets the stripe webhook writes
// for Stripe refunds, and the Candid refunds Candid imports from Stripe, are recorded here. Every
// locally recorded entry is re-synced: both writers dedup, so this also repairs an earlier attempt
// that died after stamping the notice.
const recordManualRefundOffsets = async (
  input: RefundEffectInput,
  refunds: PaymentRefundDTO[],
  { clinicalOystehr, billingOystehr, secrets }: RefundContext
): Promise<void> => {
  const { notice, encounterId } = input;
  const manualRefunds = refunds.filter((refund) => isLocallyRecordedRefund(refund) && !isPendingReservation(refund));
  if (manualRefunds.length === 0) return;

  await recordLocalRefundOffsets(billingOystehr, notice, encounterId, secrets, manualRefunds);

  if (shouldUseCandid(secrets)) {
    const candidApiClient = await getOrCreateCandidApiClient(clinicalOystehr, secrets);
    await syncCandidPatientRefunds({
      encounterId,
      refunds: manualRefunds,
      oystehr: clinicalOystehr,
      candidApiClient,
    });
  }
};

// Records a refund of a payment with no processor link (cash, check, external reader) on the notice.
const performManualRefund = async (
  input: RefundEffectInput,
  context: RefundContext
): Promise<RefundPatientPaymentResponse> => {
  const {
    notice,
    existingRefunds,
    refundAmountInCents,
    reason,
    notes,
    refundedBy,
    manualRefundId: refundId,
    resumeRefund,
  } = input;

  const refundEntry: PaymentRefundDTO = resumeRefund ?? {
    stripeRefundId: refundId,
    amountInCents: refundAmountInCents,
    dateISO: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    status: 'succeeded',
    reason,
    notes,
    refundedBy,
  };
  const refunds: PaymentRefundDTO[] = resumeRefund ? existingRefunds : [...existingRefunds, refundEntry];

  await applyRefundsToPaymentNotice(context.billingOystehr, notice, refunds);

  await recordManualRefundOffsets(input, refunds, context);

  return { refundId, amountInCents: refundEntry.amountInCents };
};

// Records a refund issued outside Stripe (external reader, cash, check, ...) for a Stripe-linked payment:
// FHIR-only refund entry with its AR offset, and a documentation-only note on the Stripe payment
// intent. No money moves through Stripe.
const performExternalRefund = async (
  input: RefundEffectInput,
  context: RefundContext,
  stripeClient: Stripe
): Promise<RefundPatientPaymentResponse> => {
  const {
    notice,
    stripePaymentId,
    stripeAccount,
    existingRefunds,
    refundAmountInCents,
    reason,
    notes,
    refundedBy,
    medium,
    manualRefundId: refundId,
    resumeRefund,
  } = input;

  const refundEntry: PaymentRefundDTO = resumeRefund ?? {
    stripeRefundId: refundId,
    amountInCents: refundAmountInCents,
    dateISO: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    status: 'succeeded',
    reason,
    notes,
    refundedBy,
    medium,
  };
  const refunds: PaymentRefundDTO[] = resumeRefund ? existingRefunds : [...existingRefunds, refundEntry];

  await applyRefundsToPaymentNotice(context.billingOystehr, notice, refunds, input.expiredReservationIds);

  await recordManualRefundOffsets(input, refunds, context);

  // documentation only — makes the external refund visible next to the payment in Stripe
  if (stripePaymentId) {
    try {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(stripePaymentId, { stripeAccount });
      // deterministic (built from the stored entry) so retries can detect it's already noted
      const summary = `$${(refundEntry.amountInCents / 100).toFixed(2)} refunded via ${
        refundEntry.medium
      } on ${refundEntry.dateISO.slice(0, 10)}${refundEntry.refundedBy ? ` by ${refundEntry.refundedBy}` : ''} (${
        refundEntry.reason
      })${refundEntry.notes ? `: ${refundEntry.notes}` : ''}`;
      const previous = paymentIntent.metadata?.external_refunds;
      if (!previous?.includes(summary)) {
        // newest first so the 500-char stripe metadata cap truncates old history, never the new entry
        const externalRefundsNote = [summary, previous].filter(Boolean).join(' | ').slice(0, 500);
        await stripeClient.paymentIntents.update(
          stripePaymentId,
          { metadata: { external_refunds: externalRefundsNote } },
          { stripeAccount }
        );
      }
    } catch (error: unknown) {
      // the refund is already recorded in FHIR; a missing Stripe note is not worth failing the request
      console.error('Failed to note external refund on Stripe payment intent', stripePaymentId, error);
    }
  }

  return { refundId, amountInCents: refundEntry.amountInCents };
};

const performEffect = async (
  input: RefundEffectInput,
  context: RefundContext,
  stripeClient: Stripe
): Promise<RefundPatientPaymentResponse> => {
  const { billingOystehr } = context;
  const { notice, stripePaymentId, stripeAccount, existingRefunds, refundAmountInCents, reason, notes, refundedBy } =
    input;

  if (!stripePaymentId) {
    return performManualRefund(input, context);
  }

  if (input.external) {
    return performExternalRefund(input, context, stripeClient);
  }

  const reservationRemoveIds = [
    ...(input.pendingReservationId ? [input.pendingReservationId] : []),
    ...(input.expiredReservationIds ?? []),
  ];

  // Stripe already created this refund on a prior attempt; finish the stamping and release the reservation
  if (input.resumeRefund) {
    await applyRefundsToPaymentNotice(billingOystehr, notice, existingRefunds, reservationRemoveIds);
    return { refundId: input.resumeRefund.stripeRefundId, amountInCents: input.resumeRefund.amountInCents };
  }

  // Reserve the balance on the notice before money moves: the version guard makes one of two
  // concurrent refund flows fail here, before Stripe is called, instead of over-refunding.
  if (input.pendingReservationId) {
    const reservation: PaymentRefundDTO = {
      stripeRefundId: input.pendingReservationId,
      amountInCents: refundAmountInCents,
      dateISO: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
      status: 'pending',
      reason,
      notes,
      refundedBy,
    };
    await applyRefundsToPaymentNotice(
      billingOystehr,
      notice,
      [...existingRefunds, reservation],
      input.expiredReservationIds
    );
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripeClient.refunds.create(
      {
        payment_intent: stripePaymentId,
        amount: refundAmountInCents,
        reason: reason === 'Duplicate charge' ? 'duplicate' : 'requested_by_customer',
        // reason/notes/refundedBy survive webhook re-stamps; operationKey lets retries find this refund
        metadata: {
          reason,
          ...(notes ? { notes } : {}),
          ...(refundedBy ? { refundedBy } : {}),
          ...(input.operationKey ? { operationKey: input.operationKey } : {}),
        },
      },
      {
        stripeAccount,
        // retries of the same attempt reuse Stripe's stored response instead of double-refunding
        ...(input.operationKey ? { idempotencyKey: `refund_${input.operationKey}` } : {}),
      }
    );
  } catch (error: unknown) {
    console.error('Stripe refund failed', error);
    // Release only when Stripe provably created no refund (4xx API rejections). Transport/5xx
    // failures are indeterminate: Stripe may have accepted the idempotent request, so the
    // reservation must keep holding the balance until the operation-key reconcile or TTL settles it.
    const definitiveFailure =
      error instanceof Stripe.errors.StripeError &&
      ['StripeCardError', 'StripeInvalidRequestError', 'StripePermissionError', 'StripeAuthenticationError'].includes(
        error.type
      );
    if (definitiveFailure && input.pendingReservationId && notice.id) {
      try {
        const currentNotice = await billingOystehr.fhir.get<PaymentNotice>({
          resourceType: 'PaymentNotice',
          id: notice.id,
        });
        await applyRefundsToPaymentNotice(
          billingOystehr,
          currentNotice,
          parsePaymentRefundsFromNotice(currentNotice) ?? [],
          [input.pendingReservationId]
        );
      } catch (releaseError) {
        console.error('Failed to release refund reservation', input.pendingReservationId, releaseError);
      }
    }
    throw parseStripeError(error);
  }

  // Stamp the notice right away so the UI reflects the refund without waiting for the webhook.
  // Re-read first (the reservation bumped the version) and build from the fresh notice's refunds so
  // anything stamped since our snapshot survives; release the reservation in the same patch.
  const freshNotice = notice.id
    ? await billingOystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: notice.id })
    : notice;
  const freshRefunds = parsePaymentRefundsFromNotice(freshNotice) ?? existingRefunds;
  await applyRefundsToPaymentNotice(
    billingOystehr,
    freshNotice,
    [...freshRefunds.filter((existing) => existing.stripeRefundId !== refund.id), stripeRefundToDTO(refund)],
    reservationRemoveIds
  );

  return { refundId: refund.id, amountInCents: refundAmountInCents };
};
