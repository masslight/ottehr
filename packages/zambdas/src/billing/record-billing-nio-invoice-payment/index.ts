import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getNioInvoicePaymentId } from 'utils/lib/fhir/billing-invoice';
import { RecordBillingNioInvoicePaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { RecordBillingNioInvoicePaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getInvoicePaymentReference, sumPatientPayments, toClaimPatientPayment } from '../claim-amounts';
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
  params,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  params: RecordNioInvoicePaymentParams;
  now?: DateTime;
}): Promise<RecordBillingNioInvoicePaymentResponse> {
  const { idempotencyKey: paymentId, ...payment } = params;
  const recorded = (await fetchInvoicePaymentNotices(oystehr, [payment.invoiceId])).filter(
    (notice) => getNioInvoicePaymentId(notice) === paymentId
  );
  if (recorded.length > 0) {
    const { paymentDate: recordedDate, method: recordedMethod } = toClaimPatientPayment(recorded[0]);
    const samePayment =
      Math.round(sumPatientPayments(recorded) * 100) === payment.amountInCents &&
      recordedMethod === payment.paymentMethod &&
      recordedDate === payment.paymentDate &&
      getInvoicePaymentReference(recorded[0]) === payment.reference;
    if (!samePayment) throw MANUAL_PAYMENT_CONFLICT_ERROR(paymentId);
    return {
      paymentId,
    };
  }
  await recordInvoicePayment({
    oystehr,
    payment: {
      ...payment,
      paymentId,
    },
    createdISO: now.toUTC().toISO()!,
  });
  return {
    paymentId,
  };
}
