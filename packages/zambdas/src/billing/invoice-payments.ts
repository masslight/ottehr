import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Invoice, PaymentNotice, ProvenanceAgent } from 'fhir/r4b';
import {
  BillingInvoiceClaim,
  getBillingInvoiceClaims,
  getInvoiceNumber,
  getNioInvoicePaymentId,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getInvoiceBalanceInCents } from './claim-amounts';
import {
  assertInvoiceTakesRecordedPayments,
  buildInvoicePaymentAttachment,
  fetchInvoicePaymentNotices,
} from './invoices';
import { buildPaymentNotice, paymentNoticeHistoryRequest } from './payments';
import { fetchById } from './shared';

export interface InvoicePayment {
  invoiceId: string;
  paymentId: string;
  amountInCents: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  attachment?: {
    path: string;
    fileName: string;
    mimeType?: string;
  };
  agent: ProvenanceAgent;
  secrets: Secrets;
}

interface PayableInvoice {
  invoice: Invoice;
  notices: PaymentNotice[];
  recorded: boolean;
}

export async function readPayableInvoice({
  oystehr,
  invoiceId,
  paymentId,
  amountInCents,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  paymentId: string;
  amountInCents: number;
}): Promise<PayableInvoice> {
  const [invoice, notices] = await Promise.all([
    fetchById<Invoice>(oystehr, 'Invoice', invoiceId),
    fetchInvoicePaymentNotices(oystehr, [invoiceId]),
  ]);
  const recorded = notices.some((notice) => getNioInvoicePaymentId(notice) === paymentId);
  if (!recorded) assertInvoicePayableInFull(invoice, notices, amountInCents);
  return {
    invoice,
    notices,
    recorded,
  };
}

function assertInvoicePayableInFull(invoice: Invoice, notices: PaymentNotice[], amountInCents: number): void {
  assertInvoiceTakesRecordedPayments(invoice);
  const invoiceNumber = getInvoiceNumber(invoice) ?? invoice.id;
  if (invoice.status !== 'issued') {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceNumber} is ${invoice.status}, so it can't take a payment`);
  }
  if (!invoice.issuer) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`Invoice ${invoiceNumber} has no issuer`);

  const balanceInCents = getInvoiceBalanceInCents(invoice, notices);
  if (balanceInCents !== sumLines(getBillingInvoiceClaims(invoice))) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoiceNumber} already has a payment, and only full payments can be recorded`);
  }
  if (amountInCents !== balanceInCents) {
    throw INVALID_INPUT_ERROR(`The payment must be the invoice balance of ${formatCurrency(balanceInCents / 100)}`);
  }
}

const sumLines = (lines: BillingInvoiceClaim[]): number => lines.reduce((sum, line) => sum + line.amountCents, 0);

// Locked to the invoice version the balance was read at; a writer that loses a race re-reads.
export async function recordInvoicePayment({
  oystehr,
  payment,
  createdISO,
}: {
  oystehr: Oystehr;
  payment: InvoicePayment;
  createdISO: string;
}): Promise<void> {
  await withVersionConflictRetries(async () => {
    const { invoice, recorded } = await readPayableInvoice({
      oystehr,
      invoiceId: payment.invoiceId,
      paymentId: payment.paymentId,
      amountInCents: payment.amountInCents,
    });
    if (recorded) return;
    await oystehr.fhir.transaction<FhirResource>({
      requests: [
        getPatchBinary({
          resourceType: 'Invoice',
          resourceId: payment.invoiceId,
          ifMatch: makeOptimisticLockIfMatchHeader(invoice),
          patchOperations: [
            {
              op: 'replace',
              path: '/status',
              value: 'balanced',
            },
          ],
        }),
        ...invoicePaymentRequests({
          invoice,
          payment,
          createdISO,
        }),
      ],
    });
  });
}

function invoicePaymentRequests({
  invoice,
  payment,
  createdISO,
}: {
  invoice: Invoice;
  payment: InvoicePayment;
  createdISO: string;
}): BatchInputRequest<FhirResource>[] {
  const { invoiceId, paymentId, paymentMethod, paymentDate, reference, attachment, agent, secrets } = payment;
  const lines = getBillingInvoiceClaims(invoice);
  const noticeFullUrls = lines.map(() => `urn:uuid:${randomUUID()}`);
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
      disposition: `Payment toward invoice ${getInvoiceNumber(invoice) ?? invoiceId}`,
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
  return [...noticeRequests, ...attachmentRequests];
}
