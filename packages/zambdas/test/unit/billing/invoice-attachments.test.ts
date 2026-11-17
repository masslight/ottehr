import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  buildAttachmentDocumentReference,
  invoiceAttachmentOwner,
  newAttachmentLocation,
  ownedAttachmentLocation,
} from '../../../src/billing/attachments';

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
