import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  mergeStripeRefundsWithStored,
  parsePaymentRefundsFromNotice,
  settledRefundTotalInCents,
} from 'utils/lib/fhir/paymentRefunds';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import { Secrets } from 'utils/lib/secrets';
import {
  PAYMENT_REFUND_MEDIUMS,
  PAYMENT_REFUND_VOID_REASONS,
  PaymentRefundDTO,
  RefundPatientPaymentInput,
  RefundPatientPaymentResponse,
} from 'utils/lib/types/api/patient-payment-types';
import { RoleType } from 'utils/lib/types/api/user.types';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  parseStripeError,
} from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, recordBillingManualRefund } from '../../../billing/payments';
import { createBillingClient } from '../../../billing/shared';
import { getUserToken, requireUserWithRole } from '../../../shared/auth';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
import { practitionerRefForUser } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import {
  applyRefundsToPaymentNotice,
  getStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
  stripeRefundToDTO,
} from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

const ZAMBDA_NAME = 'patient-payments-refund';

export const PAYMENT_MANAGEMENT_ROLES = [RoleType.BillingAdmin];

// no processor link in these flows, so their refunds are recorded in FHIR only
const MANUAL_REFUNDABLE_PAYMENT_METHODS = ['cash', 'check', 'external-card-reader'];

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrM2MClientToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: RefundPatientPaymentInput;
  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    console.log(error);
    return lambdaResponse(400, { message: error.message });
  }
  const secrets = input.secrets;

  const user = await requireUserWithRole(getUserToken(input), secrets, PAYMENT_MANAGEMENT_ROLES);

  if (!oystehrM2MClientToken) {
    oystehrM2MClientToken = await getAuth0Token(secrets);
  }
  const oystehrClient = createClinicalOystehrClient(oystehrM2MClientToken, secrets);
  const stripeClient = getStripeClient(secrets);

  const effectInput = await complexValidation(validatedParameters, oystehrClient, stripeClient);

  const refundedBy = (await practitionerRefForUser(user, oystehrClient)).display;

  const response = await performEffect({ ...effectInput, refundedBy }, oystehrClient, stripeClient, secrets);
  return lambdaResponse(200, response);
});

interface RefundEffectInput {
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
  idempotencyKey?: string;
  // set when the refund was already stamped by a previous attempt; effects re-run idempotently
  resumeRefund?: PaymentRefundDTO;
}

const complexValidation = async (
  params: RefundPatientPaymentInput,
  oystehrClient: Oystehr,
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

  const manualRefundId = `manual_${idempotencyKey ?? randomUUID()}`;

  const notice = await oystehrClient.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: paymentNoticeId });

  if (notice.request?.reference !== `Encounter/${encounterId}`) {
    throw INVALID_INPUT_ERROR('PaymentNotice does not belong to the specified encounter.');
  }

  const stripePaymentId = notice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
  if (notice.status === 'cancelled') {
    throw INVALID_INPUT_ERROR('This payment has been voided.');
  }

  if (!stripePaymentId) {
    if (external) {
      throw INVALID_INPUT_ERROR(
        'External refunds only apply to Stripe-linked payments; this payment is already recorded manually.'
      );
    }
    const paymentMethod = notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString;
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
        idempotencyKey,
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
      idempotencyKey,
    };
  }

  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehrClient);

  let existingRefunds: PaymentRefundDTO[];
  let stripeResumeRefund: PaymentRefundDTO | undefined;
  try {
    const stripeRefundList = (
      await stripeClient.refunds.list({ payment_intent: stripePaymentId, limit: 100 }, { stripeAccount })
    ).data;
    // a retry after Stripe created the refund but stamping failed finds it by its operation key
    const priorRefund = idempotencyKey
      ? stripeRefundList.find((refund) => refund.metadata?.operationKey === idempotencyKey)
      : undefined;
    stripeResumeRefund = priorRefund ? stripeRefundToDTO(priorRefund) : undefined;
    // externally recorded refunds live only in FHIR but still reduce what remains refundable
    existingRefunds = mergeStripeRefundsWithStored(
      parsePaymentRefundsFromNotice(notice),
      stripeRefundList.map(stripeRefundToDTO)
    );
  } catch (error: unknown) {
    console.error('Stripe refund lookup failed', error);
    throw parseStripeError(error);
  }

  const amountInCents = Math.round((notice.amount?.value ?? 0) * 100);
  const resumeRefund = external
    ? existingRefunds.find((refund) => refund.stripeRefundId === manualRefundId)
    : stripeResumeRefund;
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
      idempotencyKey,
      resumeRefund,
    };
  }

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
    stripePaymentId,
    stripeAccount,
    existingRefunds,
    refundAmountInCents,
    reason,
    notes,
    external,
    medium,
    manualRefundId,
    idempotencyKey,
  };
};

// Records the refund on the clinical notice, stamps any billing copies, and writes the negative
// billing AR notice the stripe webhook would have produced for a processor refund.
const performManualRefund = async (
  input: RefundEffectInput,
  oystehrClient: Oystehr,
  billingClient: Oystehr,
  secrets: Secrets | null
): Promise<RefundPatientPaymentResponse> => {
  const {
    notice,
    encounterId,
    paymentMethod,
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

  await applyRefundsToPaymentNotice(oystehrClient, notice, refunds);

  // billing copies carry the clinical notice id as their dedup identifier
  const billingNotices = (
    await billingClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'identifier', value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${notice.id}` }],
    })
  ).unbundle();

  for (const billingNotice of billingNotices) {
    await applyRefundsToPaymentNotice(billingClient, billingNotice, refunds);
  }

  // only offset AR when the payment was bridged to billing in the first place
  if (billingNotices.length > 0 && paymentMethod) {
    await recordBillingManualRefund(billingClient, {
      encounterId,
      refundId,
      amountInCents: refundEntry.amountInCents,
      paymentMethod,
      createdISO: refundEntry.dateISO,
      reason,
      secrets,
    });
  }

  return { refundId, amountInCents: refundEntry.amountInCents };
};

// Records a refund issued outside Stripe (external reader, cash, check, ...) for a Stripe-linked payment:
// FHIR-only refund entry, billing stamps + negative AR notice, and a documentation-only note on the
// Stripe payment intent. No money moves through Stripe.
const performExternalRefund = async (
  input: RefundEffectInput,
  oystehrClient: Oystehr,
  billingClient: Oystehr,
  stripeClient: Stripe,
  secrets: Secrets | null
): Promise<RefundPatientPaymentResponse> => {
  const {
    notice,
    encounterId,
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

  await applyRefundsToPaymentNotice(oystehrClient, notice, refunds);

  // billing copies of a Stripe payment carry the charge/payment-intent id; bridged ones carry the clinical notice id
  const identifierValues = [
    `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${notice.id}`,
    `${STRIPE_PAYMENT_ID_SYSTEM}|${stripePaymentId}`,
  ].join(',');
  const billingNotices = (
    await billingClient.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [{ name: 'identifier', value: identifierValues }],
    })
  ).unbundle();

  for (const billingNotice of billingNotices) {
    await applyRefundsToPaymentNotice(billingClient, billingNotice, refunds);
  }

  // only offset AR when the payment reached billing in the first place
  if (billingNotices.length > 0 && medium) {
    await recordBillingManualRefund(billingClient, {
      encounterId,
      refundId,
      amountInCents: refundEntry.amountInCents,
      paymentMethod: medium,
      createdISO: refundEntry.dateISO,
      reason,
      secrets,
    });
  }

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
  oystehrClient: Oystehr,
  stripeClient: Stripe,
  secrets: Secrets | null
): Promise<RefundPatientPaymentResponse> => {
  const { notice, stripePaymentId, stripeAccount, existingRefunds, refundAmountInCents, reason, notes, refundedBy } =
    input;

  if (!stripePaymentId) {
    return performManualRefund(input, oystehrClient, createBillingClient(oystehrM2MClientToken, secrets), secrets);
  }

  if (input.external) {
    return performExternalRefund(
      input,
      oystehrClient,
      createBillingClient(oystehrM2MClientToken, secrets),
      stripeClient,
      secrets
    );
  }

  // Stripe already created this refund on a prior attempt; finish the stamping only
  if (input.resumeRefund) {
    await applyRefundsToPaymentNotice(oystehrClient, notice, existingRefunds);
    return { refundId: input.resumeRefund.stripeRefundId, amountInCents: input.resumeRefund.amountInCents };
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
          ...(input.idempotencyKey ? { operationKey: input.idempotencyKey } : {}),
        },
      },
      {
        stripeAccount,
        // retries of the same attempt reuse Stripe's stored response instead of double-refunding
        ...(input.idempotencyKey ? { idempotencyKey: `refund_${input.idempotencyKey}` } : {}),
      }
    );
  } catch (error: unknown) {
    console.error('Stripe refund failed', error);
    throw parseStripeError(error);
  }

  // stamp the notice right away so the UI reflects the refund without waiting for the webhook
  await applyRefundsToPaymentNotice(oystehrClient, notice, [
    ...existingRefunds.filter((existing) => existing.stripeRefundId !== refund.id),
    stripeRefundToDTO(refund),
  ]);

  return { refundId: refund.id, amountInCents: refundAmountInCents };
};

const validateRequestParameters = (input: ZambdaInput): RefundPatientPaymentInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { encounterId, paymentNoticeId, reason, notes, amountInCents, external, medium, idempotencyKey } =
    safeJsonParse(input.body);

  const missing = [!encounterId && 'encounterId', !paymentNoticeId && 'paymentNoticeId', !reason && 'reason'].filter(
    Boolean
  ) as string[];
  if (missing.length) {
    throw MISSING_REQUIRED_PARAMETERS(missing);
  }
  if (!isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR('"encounterId" must be a valid UUID.');
  }
  if (typeof paymentNoticeId !== 'string' || !isValidUUID(paymentNoticeId)) {
    throw INVALID_INPUT_ERROR('"paymentNoticeId" must be a valid UUID.');
  }
  if (!PAYMENT_REFUND_VOID_REASONS.includes(reason)) {
    throw INVALID_INPUT_ERROR(`"reason" must be one of: ${PAYMENT_REFUND_VOID_REASONS.join(', ')}`);
  }
  if (notes !== undefined && typeof notes !== 'string') {
    throw INVALID_INPUT_ERROR('"notes" must be a string.');
  }
  if (amountInCents !== undefined && (!Number.isInteger(amountInCents) || amountInCents <= 0)) {
    throw INVALID_INPUT_ERROR('"amountInCents" must be a positive integer.');
  }
  if (external !== undefined && typeof external !== 'boolean') {
    throw INVALID_INPUT_ERROR('"external" must be a boolean.');
  }
  if (external && !PAYMENT_REFUND_MEDIUMS.includes(medium)) {
    throw INVALID_INPUT_ERROR(`"medium" must be one of: ${PAYMENT_REFUND_MEDIUMS.join(', ')}`);
  }
  if (!external && medium !== undefined) {
    throw INVALID_INPUT_ERROR('"medium" only applies to external refunds.');
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !isValidUUID(idempotencyKey))) {
    throw INVALID_INPUT_ERROR('"idempotencyKey" must be a valid UUID.');
  }

  return {
    encounterId,
    paymentNoticeId,
    reason,
    notes: notes || undefined,
    amountInCents,
    external: external || undefined,
    medium: external ? medium : undefined,
    idempotencyKey,
  };
};
