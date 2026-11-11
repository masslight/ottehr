import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Invoice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
  buildBillingInvoice,
  BuildBillingInvoiceInput,
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getBillingInvoiceIdempotencyKey,
  getBillingInvoiceKind,
  getInvoiceNumber,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { isVersionConflictError } from 'utils/lib/fhir/helpers';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { uploadObjectToZ3 } from 'utils/lib/helpers/presigned-file-url/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CreateBillingNioInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { CreateBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { BILLING_INVOICE_CONFLICT_ERROR, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { MIME_TYPES } from 'utils/lib/utils/file';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { NioInvoicePdfData, renderNioInvoicePdf } from '../../shared/pdf/nio-invoice-pdf';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import {
  buildAttachmentDocumentReference,
  INVOICE_ATTACHMENT_PATH_PREFIX,
  invoiceAttachmentOwner,
  newAttachmentLocation,
  ownedAttachmentLocation,
  presignAttachment,
} from '../attachments';
import { issueInvoiceNumber } from '../invoice-number';
import { ACTIVE_INVOICE_STATUSES, createInvoiceUnlessClaimsHaveOne, fetchActiveClaimInvoices } from '../invoices';
import { assembleNioInvoice } from '../nio-invoice';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-nio-invoice';

const CLAIMS_ALREADY_INVOICED = 'Some of these claims are already on an invoice';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { claimIds, idempotencyKey, secrets } = validateWithSchema(CreateBillingNioInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    claimIds,
    idempotencyKey,
    secrets,
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 201,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  claimIds,
  idempotencyKey,
  secrets,
}: {
  oystehr: Oystehr;
  claimIds: string[];
  idempotencyKey: string;
  secrets: Secrets;
}): Promise<CreateBillingNioInvoiceResponse> {
  const resumed = await findInvoiceByIdempotencyKey(oystehr, idempotencyKey);
  if (resumed) {
    if (getBillingInvoiceKind(resumed) !== 'nio') {
      throw INVALID_INPUT_ERROR('This idempotency key was already used for a patient invoice');
    }
    assertSameClaims(resumed, claimIds);
    const documentReference = await findInvoicePdf(oystehr, resumed.id!);
    if (documentReference) {
      return toResponse({
        oystehr,
        invoice: resumed,
        documentReference,
        secrets,
      });
    }
  }

  const draft = await assembleNioInvoice({
    oystehr,
    claimIds,
    resumedInvoiceId: resumed?.id,
  });
  if (resumed && getIdFromReference(resumed.recipient?.reference, 'Organization') !== draft.nioId) {
    throw BILLING_INVOICE_CONFLICT_ERROR(
      'The claims moved to another non-insurance payer after this invoice was saved'
    );
  }
  const invoice =
    resumed ??
    (await createNioInvoice({
      oystehr,
      input: draft.invoice,
      claimIds,
      idempotencyKey,
    }));
  const documentReference = await uploadInvoicePdf({
    oystehr,
    invoice,
    pdf: savedInvoicePdf(invoice, draft.pdf),
    secrets,
  });
  return toResponse({
    oystehr,
    invoice,
    documentReference,
    secrets,
  });
}

async function findInvoiceByIdempotencyKey(oystehr: Oystehr, idempotencyKey: string): Promise<Invoice | undefined> {
  const invoices = (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [
        {
          name: 'identifier',
          value: `${BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM}|${idempotencyKey}`,
        },
        {
          name: 'status',
          value: ACTIVE_INVOICE_STATUSES,
        },
      ],
    })
  ).unbundle();
  return invoices[0];
}

function assertSameClaims(invoice: Invoice, claimIds: string[]): void {
  const invoiceClaimIds = new Set(getBillingInvoiceClaims(invoice).map(({ claimId }) => claimId));
  if (invoiceClaimIds.size !== claimIds.length || !claimIds.every((claimId) => invoiceClaimIds.has(claimId))) {
    throw INVALID_INPUT_ERROR('This idempotency key was already used to invoice other claims');
  }
}

async function createNioInvoice({
  oystehr,
  input,
  claimIds,
  idempotencyKey,
}: {
  oystehr: Oystehr;
  input: BuildBillingInvoiceInput;
  claimIds: string[];
  idempotencyKey: string;
}): Promise<Invoice> {
  const invoice = buildBillingInvoice(input);
  invoice.identifier = [
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: await issueInvoiceNumber(oystehr),
    },
    {
      system: BILLING_INVOICE_IDEMPOTENCY_KEY_SYSTEM,
      value: idempotencyKey,
    },
  ];

  let saved: Invoice;
  try {
    saved = await createInvoiceUnlessClaimsHaveOne(oystehr, invoice);
  } catch (error) {
    // More than one invoice already holds these claims.
    if (isVersionConflictError(error)) throw BILLING_INVOICE_CONFLICT_ERROR(CLAIMS_ALREADY_INVOICED);
    throw error;
  }
  if (getBillingInvoiceIdempotencyKey(saved) !== idempotencyKey) {
    throw BILLING_INVOICE_CONFLICT_ERROR(CLAIMS_ALREADY_INVOICED);
  }
  assertSameClaims(saved, claimIds);
  await withdrawIfOutnumbered(oystehr, saved);
  return saved;
}

// if an invoice with a lower number for the same request exists, withdraw yourself
async function withdrawIfOutnumbered(oystehr: Oystehr, invoice: Invoice): Promise<void> {
  const claimIds = getBillingInvoiceClaims(invoice).map(({ claimId }) => claimId);
  const number = getInvoiceNumber(invoice)!;
  const rivals = (await fetchActiveClaimInvoices(oystehr, claimIds)).filter((rival) => rival.id !== invoice.id);
  const outnumbered = rivals.some((rival) => {
    const rivalNumber = getInvoiceNumber(rival);
    return (
      !rivalNumber ||
      rivalNumber.localeCompare(number, undefined, {
        numeric: true,
      }) < 0
    );
  });
  if (!outnumbered) return;

  await oystehr.fhir.update<Invoice>(
    {
      ...invoice,
      status: 'entered-in-error',
    },
    {
      optimisticLockingVersionId: invoice.meta?.versionId,
    }
  );
  throw BILLING_INVOICE_CONFLICT_ERROR(CLAIMS_ALREADY_INVOICED);
}

function savedInvoicePdf(invoice: Invoice, pdf: Omit<NioInvoicePdfData, 'invoiceNumber'>): NioInvoicePdfData {
  const amounts = new Map(getBillingInvoiceClaims(invoice).map(({ claimId, amountCents }) => [claimId, amountCents]));
  return {
    ...pdf,
    invoiceNumber: getInvoiceNumber(invoice)!,
    issueDate: DateTime.fromISO(invoice.date!).toISODate()!,
    dueDate: getBillingInvoiceDueDate(invoice)!,
    lines: pdf.lines.map((line) => ({
      ...line,
      amountCents: amounts.get(line.claimId)!,
    })),
  };
}

async function findInvoicePdf(oystehr: Oystehr, invoiceId: string): Promise<DocumentReference | undefined> {
  const documentReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: 'related',
          value: `Invoice/${invoiceId}`,
        },
        {
          name: 'status',
          value: 'current',
        },
      ],
    })
  ).unbundle();
  return documentReferences[0];
}

async function uploadInvoicePdf({
  oystehr,
  invoice,
  pdf,
  secrets,
}: {
  oystehr: Oystehr;
  invoice: Invoice;
  pdf: NioInvoicePdfData;
  secrets: Secrets;
}): Promise<DocumentReference> {
  const fileName = `${pdf.invoiceNumber}.pdf`;
  const location = newAttachmentLocation(secrets['PROJECT_ID'], INVOICE_ATTACHMENT_PATH_PREFIX, invoice.id!, fileName);
  const [bytes, uploadUrl] = await Promise.all([
    renderNioInvoicePdf(pdf),
    presignAttachment(oystehr, location, 'upload'),
  ]);
  await uploadObjectToZ3(bytes, uploadUrl, MIME_TYPES.PDF);
  return oystehr.fhir.create<DocumentReference>(
    buildAttachmentDocumentReference({
      location,
      projectApi: secrets['PROJECT_API'],
      title: fileName,
      contentType: MIME_TYPES.PDF,
      relatedReference: `Invoice/${invoice.id}`,
    })
  );
}

async function toResponse({
  oystehr,
  invoice,
  documentReference,
  secrets,
}: {
  oystehr: Oystehr;
  invoice: Invoice;
  documentReference: DocumentReference;
  secrets: Secrets;
}): Promise<CreateBillingNioInvoiceResponse> {
  const location = ownedAttachmentLocation(documentReference, invoiceAttachmentOwner(invoice.id!, secrets));
  return {
    invoiceId: invoice.id!,
    invoiceNumber: getInvoiceNumber(invoice)!,
    pdfUrl: await presignAttachment(oystehr, location, 'download'),
  };
}
