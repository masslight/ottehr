import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { FhirResource, Invoice, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceClaims,
  getInvoiceNumber,
  getNioInvoicePaymentId,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { RecordBillingNioInvoicePaymentInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { RecordBillingNioInvoicePaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  INVALID_INPUT_ERROR,
  MANUAL_PAYMENT_CONFLICT_ERROR,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { formatCurrency } from 'utils/lib/utils/convert';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import {
  getInvoiceBalanceInCents,
  getInvoicePaymentReference,
  sumPatientPayments,
  toClaimPatientPayment,
} from '../claim-amounts';
import {
  assertInvoiceTakesRecordedPayments,
  buildInvoicePaymentAttachment,
  fetchInvoicePaymentNotices,
} from '../invoices';
import { buildPaymentNotice, paymentNoticeHistoryRequest } from '../payments';
import { resolveClaimActor } from '../provenance';
import { createBillingClient, fetchById } from '../shared';

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

// The invoice is locked to the version its balance was read at, so a racing payment fails.
export async function performEffect({
  oystehr,
  params,
  now = DateTime.now(),
}: {
  oystehr: Oystehr;
  params: RecordNioInvoicePaymentParams;
  now?: DateTime;
}): Promise<RecordBillingNioInvoicePaymentResponse> {
  const {
    invoiceId,
    amountInCents,
    paymentMethod,
    paymentDate,
    reference,
    attachment,
    idempotencyKey: paymentId,
    agent,
    secrets,
  } = params;
  const [invoice, notices] = await Promise.all([
    fetchById<Invoice>(oystehr, 'Invoice', invoiceId),
    fetchInvoicePaymentNotices(oystehr, [invoiceId]),
  ]);
  const recorded = notices.filter((notice) => getNioInvoicePaymentId(notice) === paymentId);
  if (recorded.length > 0) {
    const { paymentDate: recordedDate, method: recordedMethod } = toClaimPatientPayment(recorded[0]);
    const samePayment =
      Math.round(sumPatientPayments(recorded) * 100) === amountInCents &&
      recordedMethod === paymentMethod &&
      recordedDate === paymentDate &&
      getInvoicePaymentReference(recorded[0]) === reference;
    if (!samePayment) throw MANUAL_PAYMENT_CONFLICT_ERROR(paymentId);
    return {
      paymentId,
    };
  }

  assertInvoiceTakesRecordedPayments(invoice);
  const invoiceNumber = getInvoiceNumber(invoice) ?? invoiceId;
  if (invoice.status !== 'issued') {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceNumber} is ${invoice.status}, so it can't take a payment`);
  }
  if (!invoice.issuer) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`Invoice ${invoiceNumber} has no issuer`);

  const lines = getBillingInvoiceClaims(invoice);
  const balanceInCents = getInvoiceBalanceInCents(invoice, notices);
  if (balanceInCents !== lines.reduce((sum, line) => sum + line.amountCents, 0)) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceNumber} already has a payment, and only full payments can be recorded`);
  }
  if (amountInCents !== balanceInCents) {
    throw INVALID_INPUT_ERROR(`The payment must be the invoice balance of ${formatCurrency(balanceInCents / 100)}`);
  }

  const noticeFullUrls = lines.map(() => `urn:uuid:${randomUUID()}`);
  const attachmentRequests: BatchInputRequest<FhirResource>[] = attachment
    ? [
        {
          method: 'POST',
          url: '/DocumentReference',
          resource: buildInvoicePaymentAttachment({
            invoiceId,
            paymentId,
            paymentNoticeReference: noticeFullUrls[0],
            ...attachment,
            secrets,
          }),
        },
      ]
    : [];
  const createdISO = now.toUTC().toISO()!;
  const noticeRequests = lines.flatMap(({ claimId, amountCents }, index): BatchInputRequest<FhirResource>[] => {
    const notice = buildPaymentNotice({
      request: {
        type: 'Claim',
        reference: `Claim/${claimId}`,
      },
      payee: invoice.issuer!,
      amountInCents: amountCents,
      paymentMethod,
      identifier: {
        system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
        value: paymentId,
      },
      paymentDate,
      createdISO,
      disposition: `Payment toward invoice ${invoiceNumber}`,
      reconciliation: reference
        ? {
            identifier: [
              {
                system: PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
                value: reference,
              },
            ],
          }
        : undefined,
      invoiceId,
    });
    const fullUrl = noticeFullUrls[index];
    const history = paymentNoticeHistoryRequest({
      targetReference: fullUrl,
      after: notice,
      agent,
    });
    return [
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: notice,
        fullUrl,
      },
      ...(history ? [history] : []),
    ];
  });

  await oystehr.fhir.transaction<FhirResource>({
    requests: [
      getPatchBinary({
        resourceType: 'Invoice',
        resourceId: invoiceId,
        ifMatch: makeOptimisticLockIfMatchHeader(invoice),
        patchOperations: [
          {
            op: 'replace',
            path: '/status',
            value: 'balanced',
          },
        ],
      }),
      ...noticeRequests,
      ...attachmentRequests,
    ],
  });

  return {
    paymentId,
  };
}
