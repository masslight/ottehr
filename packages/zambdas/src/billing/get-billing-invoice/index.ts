import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, Organization, Patient, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceClaims,
  getBillingInvoiceKind,
  getInvoiceNumber,
  isInvoicePastDue,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
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
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getInvoiceBalanceInCents, toClaimPatientPayment } from '../claim-amounts';
import { getClaimServiceDay } from '../claim-search';
import {
  fetchInvoicePaymentNotices,
  findInvoicePdf,
  getInvoicePdfDownloadUrl,
  getInvoiceStatusDatesAndAmount,
} from '../invoices';
import { createBillingClient, fhirName, findRef, resourceDisplayName } from '../shared';

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
  ).unbundle() as Resource[];
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
  const recipientReference = invoice.recipient?.reference;
  const recipient = findRef<Resource>(resources, recipientReference);
  const payments = notices
    .filter((notice) => notice.status === 'active')
    .map((notice): BillingInvoicePayment => {
      const payment = toClaimPatientPayment(notice);
      return {
        paymentNoticeId: payment.paymentNoticeId,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        method: payment.method,
        reference: getContainedReconciliation(notice)?.identifier?.find(
          (identifier) => identifier.system === PAYMENT_REFERENCE_IDENTIFIER_SYSTEM
        )?.value,
      };
    });

  return {
    ...getInvoiceStatusDatesAndAmount(invoice),
    kind: 'nio',
    number: getInvoiceNumber(invoice),
    recipient: recipient && {
      id: recipient.id!,
      name: resourceDisplayName(recipient) ?? invoice.recipient?.display ?? '',
    },
    balance: getInvoiceBalanceInCents(invoice, notices) / 100,
    pastDue: isInvoicePastDue(invoice, today),
    claims,
    payments,
    pdfUrl,
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
  ).unbundle() as Resource[];

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
