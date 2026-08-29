import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { settledRefundTotalInCents } from 'utils/lib/fhir/paymentRefunds';
import { getStripeAccountForAppointmentOrEncounter } from 'utils/lib/fhir/payments';
import {
  PAYMENT_REFUND_VOID_REASONS,
  RefundPatientPaymentInput,
  RefundPatientPaymentResponse,
} from 'utils/lib/types/api/patient-payment-types';
import { RoleType } from 'utils/lib/types/api/user.types';
import {
  INVALID_INPUT_ERROR,
  isApiError,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  parseStripeError,
} from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { getUserToken, requireUserWithRole } from '../../../shared/auth';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { lambdaResponse } from '../../../shared/lambda';
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
  const { encounterId, paymentNoticeId, reason, notes, amountInCents: requestedAmountInCents } = validatedParameters;
  const secrets = input.secrets;

  await requireUserWithRole(getUserToken(input), secrets, PAYMENT_MANAGEMENT_ROLES);

  if (!oystehrM2MClientToken) {
    oystehrM2MClientToken = await getAuth0Token(secrets);
  }
  const oystehrClient = createClinicalOystehrClient(oystehrM2MClientToken, secrets);

  const notice = await oystehrClient.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: paymentNoticeId });

  const stripePaymentId = notice.identifier?.find((id) => id.system === STRIPE_PAYMENT_ID_SYSTEM)?.value;
  if (!stripePaymentId) {
    throw INVALID_INPUT_ERROR('This payment is not linked to a Stripe payment and cannot be refunded.');
  }
  if (notice.status === 'cancelled') {
    throw INVALID_INPUT_ERROR('This payment has been voided.');
  }

  const stripeClient = getStripeClient(secrets);
  const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehrClient);

  try {
    const existingRefunds = (
      await stripeClient.refunds.list({ payment_intent: stripePaymentId, limit: 100 }, { stripeAccount })
    ).data.map(stripeRefundToDTO);

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

    const refund = await stripeClient.refunds.create(
      {
        payment_intent: stripePaymentId,
        amount: refundAmountInCents,
        reason: reason === 'Duplicate charge' ? 'duplicate' : 'requested_by_customer',
        metadata: { reason, ...(notes ? { notes } : {}) },
      },
      { stripeAccount }
    );

    // stamp the notice right away so the UI reflects the refund without waiting for the webhook
    await applyRefundsToPaymentNotice(oystehrClient, notice, [...existingRefunds, stripeRefundToDTO(refund)]);

    const response: RefundPatientPaymentResponse = { refundId: refund.id, amountInCents: refundAmountInCents };
    return lambdaResponse(200, response);
  } catch (error: unknown) {
    if (isApiError(error)) throw error;
    console.error('Stripe refund failed', error);
    throw parseStripeError(error);
  }
});

const validateRequestParameters = (input: ZambdaInput): RefundPatientPaymentInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { encounterId, paymentNoticeId, reason, notes, amountInCents } = safeJsonParse(input.body);

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

  return { encounterId, paymentNoticeId, reason, notes: notes || undefined, amountInCents };
};
