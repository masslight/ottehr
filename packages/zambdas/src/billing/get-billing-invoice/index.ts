import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, DocumentReference, Invoice, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceClaims,
  getBillingInvoiceKind,
  getInvoiceNumber,
  getNioInvoicePaymentId,
  isInvoicePastDue,
} from 'utils/lib/fhir/billing-invoice';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { Secrets } from 'utils/lib/secrets';
import { GetBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingInvoiceClaimLine,
  BillingInvoiceDetail,
  BillingInvoicePayment,
} from 'utils/lib/types/data/billing/billing.types';
import { getActiveStatusGroup, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import {
  getInvoiceBalanceInCents,
  getInvoicePaymentReference,
  sumPatientPayments,
  toClaimPatientPayment,
} from '../claim-amounts';
import { getClaimServiceDay } from '../claim-search';
import {
  fetchInvoicePaymentAttachments,
  fetchInvoicePaymentNotices,
  findInvoicePdf,
  getInvoicePaymentAttachmentDownloadUrl,
  getInvoicePdfDownloadUrl,
  getInvoiceStatusDatesAndAmount,
  getNioInvoiceRecipient,
} from '../invoices';
import { createBillingClient, fhirName, findRef } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-invoice';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { invoiceId, secrets } = validateWithSchema(GetBillingInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    invoiceId,
    secrets,
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
  invoiceId,
  secrets,
  today = DateTime.now().toISODate()!,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  secrets: Secrets;
  today?: string;
}): Promise<BillingInvoiceDetail> {
  const resources = (
    await oystehr.fhir.search<Invoice | Organization | Patient>({
      resourceType: 'Invoice',
      params: [
        {
          name: '_id',
          value: invoiceId,
        },
        {
          name: '_include',
          value: 'Invoice:recipient',
        },
      ],
    })
  ).unbundle();
  const invoice = resources.find((resource): resource is Invoice => resource.resourceType === 'Invoice');
  if (!invoice) throw FHIR_RESOURCE_NOT_FOUND('Invoice');
  if (getBillingInvoiceKind(invoice) !== 'nio') {
    throw INVALID_INPUT_ERROR('Only non-insurance payer invoices have a details view');
  }

  const [claims, notices, pdfUrl] = await Promise.all([
    fetchInvoiceClaimLines(oystehr, invoice),
    fetchInvoicePaymentNotices(oystehr, [invoiceId]),
    findInvoicePdfDownloadUrl({
      oystehr,
      invoiceId,
      secrets,
    }),
  ]);
  const organization = resources.find(
    (resource): resource is Organization =>
      resource.resourceType === 'Organization' && `Organization/${resource.id}` === invoice.recipient?.reference
  );
  const payments = await buildInvoicePayments({
    oystehr,
    invoiceId,
    notices,
    secrets,
  });

  return {
    ...getInvoiceStatusDatesAndAmount(invoice),
    kind: 'nio',
    number: getInvoiceNumber(invoice),
    recipient: getNioInvoiceRecipient(invoice, organization),
    balance: invoice.status === 'cancelled' ? undefined : getInvoiceBalanceInCents(invoice, notices) / 100,
    pastDue: isInvoicePastDue(invoice, today),
    claims,
    payments,
    pdfUrl,
    voidReason: invoice.cancelledReason,
  };
}

async function fetchInvoiceClaimLines(oystehr: Oystehr, invoice: Invoice): Promise<BillingInvoiceClaimLine[]> {
  const lines = getBillingInvoiceClaims(invoice);
  if (lines.length === 0) return [];
  const resources = (
    await oystehr.fhir.search<Claim | Patient>({
      resourceType: 'Claim',
      params: [
        {
          name: '_id',
          value: lines.map(({ claimId }) => claimId).join(','),
        },
        {
          name: '_include',
          value: 'Claim:patient',
        },
        {
          name: '_count',
          value: String(lines.length),
        },
      ],
    })
  ).unbundle();

  return lines.map(({ claimId, amountCents }) => {
    const amount = amountCents / 100;
    const claim = findRef<Claim>(resources, `Claim/${claimId}`);
    // Keep the line so the claims still add up to the invoice amount.
    if (claim?.resourceType !== 'Claim') {
      console.warn(`Invoice ${invoice.id} lists claim ${claimId}, which was not found`);
      return {
        claimId,
        patientId: '',
        patientName: '',
        serviceDate: '',
        arStage: '',
        status: '',
        amount,
      };
    }
    const patient = findRef<Patient>(resources, claim.patient?.reference);
    const statuses = getClaimStatusValues(claim);
    const statusField = getActiveStatusGroup(statuses.arStage)?.primaryFieldKey;
    return {
      claimId,
      patientId: getIdFromReference(claim.patient?.reference, 'Patient') ?? '',
      patientName: fhirName(patient),
      serviceDate: getClaimServiceDay(claim),
      arStage: statuses.arStage,
      status: statusField ? statuses[statusField] : '',
      amount,
    };
  });
}

async function buildInvoicePayments({
  oystehr,
  invoiceId,
  notices,
  secrets,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  notices: PaymentNotice[];
  secrets: Secrets;
}): Promise<BillingInvoicePayment[]> {
  const noticesByPaymentId = new Map<string, PaymentNotice[]>();
  for (const notice of notices.filter((notice) => notice.status === 'active')) {
    const paymentId = getNioInvoicePaymentId(notice) ?? notice.id ?? '';
    noticesByPaymentId.set(paymentId, [...(noticesByPaymentId.get(paymentId) ?? []), notice]);
  }
  const attachments = await fetchInvoicePaymentAttachments(oystehr, [...noticesByPaymentId.keys()]);
  return Promise.all(
    [...noticesByPaymentId].map(async ([paymentId, paymentNotices]): Promise<BillingInvoicePayment> => {
      const [first] = paymentNotices;
      const { paymentDate, method } = toClaimPatientPayment(first);
      const paymentNoticeReferences = paymentNotices.map((notice) => `PaymentNotice/${notice.id}`);
      const documentReference = attachments.find(
        (documentReference) =>
          getNioInvoicePaymentId(documentReference) === paymentId &&
          documentReference.context?.related?.some(
            (related) => related.reference && paymentNoticeReferences.includes(related.reference)
          )
      );
      const attachment = documentReference
        ? await paymentAttachmentLink({
            oystehr,
            invoiceId,
            documentReference,
            paymentNoticeReferences,
            secrets,
          })
        : undefined;
      return {
        paymentId,
        paymentDate,
        amount: roundNumberToDecimalPlaces(sumPatientPayments(paymentNotices), 2),
        method,
        reference: getInvoicePaymentReference(first),
        ...(attachment ? { attachment } : {}),
      };
    })
  );
}

async function paymentAttachmentLink({
  oystehr,
  invoiceId,
  documentReference,
  paymentNoticeReferences,
  secrets,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  documentReference: DocumentReference;
  paymentNoticeReferences: string[];
  secrets: Secrets;
}): Promise<BillingInvoicePayment['attachment']> {
  try {
    return {
      fileName: documentReference.content[0]?.attachment.title ?? '',
      url: await getInvoicePaymentAttachmentDownloadUrl({
        oystehr,
        invoiceId,
        documentReference,
        paymentNoticeReferences,
        secrets,
      }),
    };
  } catch (error) {
    console.warn(`Invoice ${invoiceId} leaves out payment attachment ${documentReference.id}:`, error);
    return undefined;
  }
}

async function findInvoicePdfDownloadUrl({
  oystehr,
  invoiceId,
  secrets,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  secrets: Secrets;
}): Promise<string | undefined> {
  const documentReference = await findInvoicePdf(oystehr, invoiceId);
  if (!documentReference) return undefined;
  return getInvoicePdfDownloadUrl({
    oystehr,
    invoiceId,
    documentReference,
    secrets,
  });
}
