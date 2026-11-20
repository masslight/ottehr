import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { getNioInvoicePaymentId } from 'utils/lib/fhir/billing-invoice';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAttachmentDocumentReference,
  invoiceAttachmentOwner,
  newAttachmentLocation,
  ownedAttachmentLocation,
} from '../../../src/billing/attachments';
import { buildInvoicePaymentAttachment, getInvoicePaymentAttachmentDownloadUrl } from '../../../src/billing/invoices';

const SECRETS = {
  PROJECT_API: 'https://project-api.zapehr.com/v1',
  PROJECT_ID: 'project-id',
};

const invoicePdf = (invoiceId: string): DocumentReference => {
  const owner = invoiceAttachmentOwner(invoiceId, SECRETS);
  return buildAttachmentDocumentReference({
    location: newAttachmentLocation(owner.projectId, owner.prefix, owner.ownerId, 'INV-00042.pdf'),
    projectApi: owner.projectApi,
    title: 'INV-00042.pdf',
    contentType: 'application/pdf',
    relatedReference: owner.reference,
  });
};

describe('invoice attachments', () => {
  it('stores an invoice PDF under the invoice and links it to the invoice', () => {
    const documentReference = invoicePdf('invoice-1');

    expect(documentReference.context?.related).toEqual([
      {
        reference: 'Invoice/invoice-1',
      },
    ]);
    expect(ownedAttachmentLocation(documentReference, invoiceAttachmentOwner('invoice-1', SECRETS))).toEqual({
      bucketName: 'project-id-billing-app',
      path: expect.stringMatching(/^invoice-attachments\/invoice-1\/.+-INV-00042\.pdf$/),
    });
  });

  it("rejects another invoice's PDF", () => {
    expect(() =>
      ownedAttachmentLocation(invoicePdf('invoice-1'), invoiceAttachmentOwner('invoice-2', SECRETS))
    ).toThrow();
  });
});

describe('invoice payment attachments', () => {
  const attachment = (path: string): DocumentReference =>
    buildInvoicePaymentAttachment({
      invoiceId: 'invoice-1',
      paymentId: 'payment-1',
      paymentNoticeReference: 'PaymentNotice/notice-1',
      path,
      fileName: 'check-88123.pdf',
      secrets: SECRETS,
    });
  const presign = vi.fn(async ({ action }: { action: string }) => ({
    signedUrl: `https://z3.test/${action}`,
  }));
  const oystehr = {
    z3: {
      getPresignedUrl: presign,
    },
  } as unknown as Oystehr;

  it("links a payment attachment to the payment's notice, not the invoice the PDF lookup searches", () => {
    const documentReference = attachment('invoice-attachments/invoice-1/abc-check-88123.pdf');

    expect(documentReference.context?.related).toEqual([
      {
        reference: 'PaymentNotice/notice-1',
      },
    ]);
    expect(getNioInvoicePaymentId(documentReference)).toBe('payment-1');
    expect(documentReference.content[0].attachment).toMatchObject({
      title: 'check-88123.pdf',
      contentType: 'application/pdf',
    });
  });

  it("refuses a file outside the invoice's folder", () => {
    expect(() => attachment('invoice-attachments/invoice-2/abc-check-88123.pdf')).toThrow();
  });

  it("downloads an attachment related to one of the payment's notices", async () => {
    const url = await getInvoicePaymentAttachmentDownloadUrl({
      oystehr,
      invoiceId: 'invoice-1',
      documentReference: attachment('invoice-attachments/invoice-1/abc-check-88123.pdf'),
      paymentNoticeReferences: ['PaymentNotice/notice-2', 'PaymentNotice/notice-1'],
      secrets: SECRETS,
    });

    expect(url).toBe('https://z3.test/download');
  });

  it("refuses to download another payment's attachment", async () => {
    await expect(
      getInvoicePaymentAttachmentDownloadUrl({
        oystehr,
        invoiceId: 'invoice-1',
        documentReference: attachment('invoice-attachments/invoice-1/abc-check-88123.pdf'),
        paymentNoticeReferences: ['PaymentNotice/notice-9'],
        secrets: SECRETS,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('is not attached to this payment'),
    });
  });
});
