import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Claim, DocumentReference, Invoice, Location, Organization, PaymentNotice } from 'fhir/r4b';
import {
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getBillingInvoiceKind,
  getHostedInvoiceUrl,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_PAYMENT_TAG_SYSTEM,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Secrets } from 'utils/lib/secrets';
import {
  BILLING_INVOICE_LIST_STATUSES,
  BillingInvoiceListStatus,
} from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceListItem, BillingInvoiceSummary } from 'utils/lib/types/data/billing/billing.types';
import { getClaimStatusValues, isInvoiceableClaimStatus } from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import {
  AttachmentOwner,
  buildAttachmentDocumentReference,
  invoiceAttachmentOwner,
  ownedAttachmentLocation,
  presignAttachment,
  resolveAttachmentContentType,
} from './attachments';
import { BILLING_APP_BUCKET, copySourceId, fetchById, findById } from './shared';

// The claim points at its own copy of the service facility. The copy records which facility it came from.
export async function getServiceFacilityId(oystehr: Oystehr, claim: Claim): Promise<string | undefined> {
  const copyId = getIdFromReference(claim.facility?.reference, 'Location');
  return copyId ? copySourceId(await findById<Location>(oystehr, 'Location', copyId)) : undefined;
}

export const ACTIVE_INVOICE_STATUSES = 'draft,issued,balanced';

const activeClaimInvoiceParams = (claimIds: string[]): SearchParam[] => [
  {
    name: '_tag',
    value: claimIds.map((claimId) => `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}`).join(','),
  },
  {
    name: '_tag',
    value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}`,
  },
  {
    name: 'status',
    value: ACTIVE_INVOICE_STATUSES,
  },
];

export async function createInvoiceUnlessClaimsHaveOne(oystehr: Oystehr, invoice: Invoice): Promise<Invoice> {
  const claimIds = getBillingInvoiceClaims(invoice).map(({ claimId }) => claimId);
  return oystehr.fhir.create<Invoice>(invoice, {
    ifNoneExist: activeClaimInvoiceParams(claimIds),
  });
}

export async function fetchActiveClaimInvoices(oystehr: Oystehr, claimIds: string[]): Promise<Invoice[]> {
  return getAllFhirSearchPages<Invoice>(
    {
      resourceType: 'Invoice',
      params: activeClaimInvoiceParams(claimIds),
    },
    oystehr
  );
}

export const invoicePdfParams = (invoiceId: string): SearchParam[] => [
  {
    name: 'related',
    value: `Invoice/${invoiceId}`,
  },
  {
    name: 'status',
    value: 'current',
  },
];

export function assertInvoiceTakesRecordedPayments(invoice: Invoice): void {
  if (getBillingInvoiceKind(invoice) !== 'nio') {
    throw INVALID_INPUT_ERROR('Only non-insurance payer invoices take recorded payments');
  }
}

// A payment's attachment is stored in the invoice's folder but related to one of the payment's
// notices, so the invoice's PDF lookup never finds it.
const invoicePaymentAttachmentOwner = (
  invoiceId: string,
  paymentNoticeReference: string,
  secrets: Secrets
): AttachmentOwner => ({
  ...invoiceAttachmentOwner(invoiceId, secrets),
  reference: paymentNoticeReference,
});

export function buildInvoicePaymentAttachment({
  invoiceId,
  paymentId,
  paymentNoticeReference,
  path,
  fileName,
  mimeType,
  secrets,
}: {
  invoiceId: string;
  paymentId: string;
  paymentNoticeReference: string;
  path: string;
  fileName: string;
  mimeType?: string;
  secrets: Secrets;
}): DocumentReference {
  const owner = invoicePaymentAttachmentOwner(invoiceId, paymentNoticeReference, secrets);
  const documentReference: DocumentReference = {
    ...buildAttachmentDocumentReference({
      location: {
        bucketName: BILLING_APP_BUCKET(owner.projectId),
        path,
      },
      projectApi: owner.projectApi,
      title: fileName,
      contentType: resolveAttachmentContentType(fileName, mimeType),
      relatedReference: owner.reference,
    }),
    identifier: [
      {
        system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
        value: paymentId,
      },
    ],
  };
  ownedAttachmentLocation(documentReference, owner);
  return documentReference;
}

export async function fetchInvoicePaymentAttachments(
  oystehr: Oystehr,
  paymentIds: string[]
): Promise<DocumentReference[]> {
  if (paymentIds.length === 0) return [];
  return getAllFhirSearchPages<DocumentReference>(
    {
      resourceType: 'DocumentReference',
      params: [
        {
          name: 'identifier',
          value: paymentIds.map((paymentId) => `${NIO_INVOICE_PAYMENT_ID_SYSTEM}|${paymentId}`).join(','),
        },
        {
          name: 'status',
          value: 'current',
        },
      ],
    },
    oystehr
  );
}

export async function getInvoicePaymentAttachmentDownloadUrl({
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
}): Promise<string> {
  const paymentNoticeReference = documentReference.context?.related?.find(
    (related) => related.reference && paymentNoticeReferences.includes(related.reference)
  )?.reference;
  if (!paymentNoticeReference) {
    throw INVALID_INPUT_ERROR(`DocumentReference ${documentReference.id} is not attached to this payment`);
  }
  const owner = invoicePaymentAttachmentOwner(invoiceId, paymentNoticeReference, secrets);
  return presignAttachment(oystehr, ownedAttachmentLocation(documentReference, owner), 'download');
}

export async function findInvoicePdf(oystehr: Oystehr, invoiceId: string): Promise<DocumentReference | undefined> {
  const documentReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: invoicePdfParams(invoiceId),
    })
  ).unbundle();
  return documentReferences[0];
}

export async function getInvoicePdfDownloadUrl({
  oystehr,
  invoiceId,
  documentReference,
  secrets,
}: {
  oystehr: Oystehr;
  invoiceId: string;
  documentReference: DocumentReference;
  secrets: Secrets;
}): Promise<string> {
  const location = ownedAttachmentLocation(documentReference, invoiceAttachmentOwner(invoiceId, secrets));
  return presignAttachment(oystehr, location, 'download');
}

export async function fetchClaimInvoices(oystehr: Oystehr, claimId: string): Promise<Invoice[]> {
  return (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [
        { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}` },
        { name: 'status', value: BILLING_INVOICE_LIST_STATUSES.join(',') },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle();
}

export const getInvoiceStatusDatesAndAmount = (invoice: Invoice): BillingInvoiceSummary => ({
  id: invoice.id!,
  status: invoice.status as BillingInvoiceListStatus,
  issueDate: invoice.date ?? '',
  dueDate: getBillingInvoiceDueDate(invoice) ?? '',
  amount: invoice.totalGross?.value ?? 0,
  hostedInvoiceUrl: getHostedInvoiceUrl(invoice),
});

// Falls back to the payer name saved on the invoice.
export function getNioInvoiceRecipient(
  invoice: Invoice,
  organization: Organization | undefined
): BillingInvoiceListItem['recipient'] {
  const id = organization?.id ?? getIdFromReference(invoice.recipient?.reference, 'Organization');
  if (!id) return undefined;
  return {
    id,
    name: organization?.name ?? invoice.recipient?.display ?? '',
  };
}

export async function fetchInvoicePaymentNotices(oystehr: Oystehr, invoiceIds: string[]): Promise<PaymentNotice[]> {
  if (invoiceIds.length === 0) return [];
  return getAllFhirSearchPages<PaymentNotice>(
    {
      resourceType: 'PaymentNotice',
      params: [
        {
          name: '_tag',
          value: invoiceIds.map((invoiceId) => `${INVOICE_PAYMENT_TAG_SYSTEM}|${invoiceId}`).join(','),
        },
      ],
    },
    oystehr
  );
}

// Returns the clinical visit behind a claim that can be invoiced.
export function getInvoiceableEncounterId(claim: Claim): string {
  if (!isInvoiceableClaimStatus(getClaimStatusValues(claim))) {
    throw INVALID_INPUT_ERROR(
      'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced'
    );
  }
  return getClaimEncounterId(claim);
}

// Returns the clinical visit behind an invoice's claim.
export async function getInvoiceEncounterId(oystehr: Oystehr, invoiceId: string): Promise<string> {
  const [{ claimId }] = getBillingInvoiceClaims(await fetchById<Invoice>(oystehr, 'Invoice', invoiceId));
  return getClaimEncounterId(await fetchById<Claim>(oystehr, 'Claim', claimId));
}

function getClaimEncounterId(claim: Claim): string {
  const encounterId = claim.identifier?.find(
    (identifier) => identifier.system === ottehrIdentifierSystem('claim-encounter-id')
  )?.value;
  if (!encounterId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Claim is not linked to a visit');
  return encounterId;
}
