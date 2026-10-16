import Oystehr from '@oystehr/sdk';
import { DocumentReference, PaymentReconciliation } from 'fhir/r4b';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { performEffect as addEraAttachment } from '../../../src/billing/add-era-attachment';
import { resolveAttachmentContentType } from '../../../src/billing/attachments';
import { performEffect as deleteEraAttachment } from '../../../src/billing/delete-era-attachment';
import { performEffect as downloadEraAttachment } from '../../../src/billing/download-era-attachment';
import { performEffect as renameEraAttachment } from '../../../src/billing/rename-era-attachment';
import { fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

const SECRETS = { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' };
const STORED_URL = 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/era-attachments/era-1/abc-Remit.pdf';
const ERA = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  meta: { versionId: '3' },
  created: '2026-09-01',
  paymentDate: '2026-09-01',
  paymentAmount: { value: 100 },
} satisfies PaymentReconciliation;
const GUARD = { method: 'PUT', url: '/PaymentReconciliation/era-1', resource: ERA, ifMatch: 'W/"3"' };
const UPLOAD = {
  eraId: 'era-1',
  name: 'UHC remit',
  fileName: 'Paper remit.pdf',
  mimeType: 'application/pdf',
  secrets: SECRETS,
};
const FILE = { eraId: 'era-1', documentReferenceId: 'doc-1', secrets: SECRETS };

const scan = (overrides: Partial<DocumentReference> = {}): DocumentReference & { id: string } => ({
  resourceType: 'DocumentReference',
  status: 'current',
  context: { related: [{ reference: 'PaymentReconciliation/era-1' }] },
  content: [{ attachment: { url: STORED_URL, contentType: 'application/pdf', title: 'Remit.pdf' } }],
  ...overrides,
  id: overrides.id ?? 'doc-1',
});

function makeClient(): Oystehr {
  return {
    fhir: { transaction: vi.fn().mockResolvedValue({ unbundle: () => [scan({ id: 'doc-new' })] }) },
    z3: {
      getPresignedUrl: vi.fn().mockResolvedValue({ signedUrl: 'signed-url' }),
      deleteObject: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('ERA attachments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchById).mockImplementation(async (_client, type) => (type === 'PaymentReconciliation' ? ERA : scan()));
  });

  it('records a remit scan and locks the ERA in the same transaction', async () => {
    const oystehr = makeClient();
    const result = await addEraAttachment(oystehr, UPLOAD);
    expect(fetchById).toHaveBeenCalledWith(oystehr, 'PaymentReconciliation', 'era-1');
    const requests = (oystehr.fhir.transaction as Mock).mock.calls[0][0].requests;
    const { 'objectPath+': objectPath, action } = (oystehr.z3.getPresignedUrl as Mock).mock.calls[0][0];
    expect(action).toBe('upload');
    expect(objectPath).toMatch(/^era-attachments\/era-1\/[0-9a-f-]{36}-Paper_remit\.pdf$/);
    expect(requests).toEqual([
      {
        method: 'POST',
        url: '/DocumentReference',
        resource: expect.objectContaining({
          context: { related: [{ reference: 'PaymentReconciliation/era-1' }] },
          content: [
            {
              attachment: {
                url: `https://project-api.zapehr.com/v1/z3/project-id-billing-app/${objectPath}`,
                contentType: 'application/pdf',
                title: 'UHC remit',
              },
            },
          ],
        }),
      },
      GUARD,
    ]);
    expect(result).toEqual({ documentReferenceId: 'doc-new', uploadUrl: 'signed-url' });
  });

  it('fails rather than hand out an upload for a record the server returned without an id', async () => {
    const oystehr = makeClient();
    (oystehr.fhir.transaction as Mock).mockResolvedValueOnce({ unbundle: () => [{ ...scan(), id: undefined }] });
    await expect(addEraAttachment(oystehr, UPLOAD)).rejects.toThrow('The remit attachment was created without an id');
  });

  it("writes nothing when the upload can't be presigned", async () => {
    const oystehr = makeClient();
    (oystehr.z3.getPresignedUrl as Mock).mockRejectedValueOnce(new Error('z3 unavailable'));
    await expect(addEraAttachment(oystehr, UPLOAD)).rejects.toThrow('z3 unavailable');
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('only accepts PDFs and images for remit scans', async () => {
    const oystehr = makeClient();
    await expect(addEraAttachment(oystehr, { ...UPLOAD, fileName: 'notes.docx', mimeType: '' })).rejects.toMatchObject({
      message: "Files of type application/octet-stream can't be attached here",
    });
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('presigns a download only for a file of this ERA', async () => {
    const oystehr = makeClient();
    await expect(downloadEraAttachment(oystehr, FILE)).resolves.toEqual({ downloadUrl: 'signed-url' });
    expect(oystehr.z3.getPresignedUrl).toHaveBeenCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'era-attachments/era-1/abc-Remit.pdf',
      action: 'download',
    });
    await expect(downloadEraAttachment(oystehr, { ...FILE, eraId: 'era-2' })).rejects.toMatchObject({
      message: 'DocumentReference doc-1 is not attached to PaymentReconciliation/era-2',
    });
  });

  it("won't reach a file outside the ERA's folder even when the record claims the ERA", async () => {
    vi.mocked(fetchById).mockResolvedValueOnce(
      scan({
        content: [
          {
            attachment: {
              url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/c1/x.pdf',
            },
          },
        ],
      })
    );
    await expect(downloadEraAttachment(makeClient(), FILE)).rejects.toMatchObject({
      message: 'Invalid Z3 URL in DocumentReference doc-1',
    });
  });

  it('deletes the record and then the stored file, even when the upload never landed', async () => {
    const oystehr = makeClient();
    (oystehr.z3.deleteObject as Mock).mockRejectedValueOnce(new Error('not found'));
    await expect(deleteEraAttachment(oystehr, FILE)).resolves.toEqual({ deleted: true });
    expect(oystehr.fhir.transaction).toHaveBeenCalledWith({
      requests: [{ method: 'DELETE', url: '/DocumentReference/doc-1' }, GUARD],
    });
    expect((oystehr.fhir.transaction as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (oystehr.z3.deleteObject as Mock).mock.invocationCallOrder[0]
    );
  });

  it.each(['server error', 'precondition failed'])('keeps the file when the transaction fails: %s', async (message) => {
    const oystehr = makeClient();
    (oystehr.fhir.transaction as Mock).mockRejectedValueOnce(new Error(message));
    await expect(deleteEraAttachment(oystehr, FILE)).rejects.toThrow(message);
    expect(oystehr.z3.deleteObject).not.toHaveBeenCalled();
  });

  it('renames the attachment title only, locking the parent ERA', async () => {
    const oystehr = makeClient();
    await renameEraAttachment(oystehr, { ...FILE, name: 'Remit (UHC).pdf' });
    expect(oystehr.fhir.transaction).toHaveBeenCalledWith({
      requests: [
        {
          method: 'PATCH',
          url: '/DocumentReference/doc-1',
          operations: [
            {
              op: 'replace',
              path: '/content',
              value: [
                {
                  attachment: {
                    url: STORED_URL,
                    contentType: 'application/pdf',
                    title: 'Remit (UHC).pdf',
                  },
                },
              ],
            },
          ],
        },
        GUARD,
      ],
    });
  });

  it('rejects all attachment mutations on a voided ERA but still allows downloads', async () => {
    vi.mocked(fetchById).mockImplementation(async (_client, type) =>
      type === 'PaymentReconciliation' ? { ...ERA, status: 'cancelled' } : scan()
    );
    const oystehr = makeClient();
    const error = { message: 'Voided ERAs cannot be changed' };
    await expect(addEraAttachment(oystehr, UPLOAD)).rejects.toMatchObject(error);
    await expect(renameEraAttachment(oystehr, { ...FILE, name: 'new' })).rejects.toMatchObject(error);
    await expect(deleteEraAttachment(oystehr, FILE)).rejects.toMatchObject(error);
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
    expect(oystehr.z3.getPresignedUrl).not.toHaveBeenCalled();
    expect(oystehr.z3.deleteObject).not.toHaveBeenCalled();
    await expect(downloadEraAttachment(oystehr, FILE)).resolves.toEqual({ downloadUrl: 'signed-url' });
  });
});

describe('resolveAttachmentContentType', () => {
  it('prefers what the browser reported and falls back to the file name', () => {
    expect(resolveAttachmentContentType('scan.PDF', '')).toBe('application/pdf');
    expect(resolveAttachmentContentType('scan', 'image/png')).toBe('image/png');
    expect(resolveAttachmentContentType('scan.tif', undefined)).toBe('image/tiff');
    expect(resolveAttachmentContentType('scan.jpg', 'image/jpg')).toBe('image/jpeg');
    expect(resolveAttachmentContentType('notes.bin', undefined)).toBe('application/octet-stream');
  });
});
