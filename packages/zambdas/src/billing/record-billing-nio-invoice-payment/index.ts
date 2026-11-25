import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getNioInvoicePaymentId } from 'utils/lib/fhir/billing-invoice';
import { FUTURE_PAYMENT_DATE_ERROR, isFuturePaymentDay } from 'utils/lib/helpers/rcm/payment-day';
import { RecordBillingNioInvoicePaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { RecordBillingNioInvoicePaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR, MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getInvoicePaymentReference, sumPatientPayments, toClaimPatientPayment } from '../claim-amounts';
import { settleOtherCardReservation } from '../invoice-card-reservation';
import { recordInvoicePayment } from '../invoice-payments';
import { fetchInvoicePaymentNotices } from '../invoices';
import { resolveClaimActor } from '../provenance';
import { createBillingClient } from '../shared';

type RecordNioInvoicePaymentParams = ValidatedZambdaInput<typeof RecordBillingNioInvoicePaymentInputSchema> & {
  agent: ProvenanceAgent;
};

let m2mToken: string;
const ZAMBDA_NAME = 'record-billing-nio-invoice-payment';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateWithSchema(RecordBillingNioInvoicePaymentInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    getStripe: () => getStripeClient(params.secrets),
    params: {
      ...params,
      agent,
    },
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  getStripe,
  params,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  getStripe: () => Stripe;
  params: RecordNioInvoicePaymentParams;
  now?: DateTime;
}): Promise<RecordBillingNioInvoicePaymentResponse> {
  const { idempotencyKey: paymentId, ...payment } = params;
  if (
    await isSamePaymentRecorded({
      oystehr,
      params,
    })
  ) {
    return {
      paymentId,
    };
  }
  if (isFuturePaymentDay(payment.paymentDate, now)) throw INVALID_INPUT_ERROR(FUTURE_PAYMENT_DATE_ERROR);
  await settleOtherCardReservation({
    oystehr,
    getStripe,
    invoiceId: payment.invoiceId,
    paymentId,
    agent: payment.agent,
    secrets: payment.secrets,
    now,
  });
  await recordInvoicePayment({
    oystehr,
    payment: {
      ...payment,
      paymentId,
    },
    createdISO: now.toUTC().toISO()!,
  });
  // a concurrent request with this key may have recorded different details first
  await isSamePaymentRecorded({
    oystehr,
    params,
  });
  return {
    paymentId,
  };
}

async function isSamePaymentRecorded({
  oystehr,
  params,
}: {
  oystehr: Oystehr;
  params: RecordNioInvoicePaymentParams;
}): Promise<boolean> {
  const { idempotencyKey: paymentId, invoiceId, amountInCents, paymentMethod, paymentDate, reference } = params;
  const recorded = (await fetchInvoicePaymentNotices(oystehr, [invoiceId])).filter(
    (notice) => getNioInvoicePaymentId(notice) === paymentId
  );
  if (recorded.length === 0) return false;
  const { paymentDate: recordedDate, method: recordedMethod } = toClaimPatientPayment(recorded[0]);
  const samePayment =
    Math.round(sumPatientPayments(recorded) * 100) === amountInCents &&
    recordedMethod === paymentMethod &&
    recordedDate === paymentDate &&
    getInvoicePaymentReference(recorded[0]) === reference;
  if (!samePayment) throw MANUAL_PAYMENT_CONFLICT_ERROR(paymentId);
  return true;
}
