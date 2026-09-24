import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
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

const scan = (overrides: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-1',
  status: 'current',
  context: { related: [{ reference: 'PaymentReconciliation/era-1' }] },
  content: [{ attachment: { url: STORED_URL, contentType: 'application/pdf', title: 'Remit.pdf' } }],
  ...overrides,
});

function makeClient(): Oystehr {
  return {
    fhir: {
      create: vi.fn(async (resource: DocumentReference) => ({ ...resource, id: 'doc-new' })),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    z3: {
      getPresignedUrl: vi.fn().mockResolvedValue({ signedUrl: 'signed-url' }),
      deleteObject: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('ERA attachments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records a remit scan against the ERA and presigns its upload', async () => {
    (fetchById as Mock).mockResolvedValueOnce({ resourceType: 'PaymentReconciliation', id: 'era-1' });
    const oystehr = makeClient();
    const eraReadClient = {} as Oystehr;

    const result = await addEraAttachment(oystehr, eraReadClient, {
      eraId: 'era-1',
      name: 'Paper remit.pdf',
      contentType: 'application/pdf',
      secrets: SECRETS,
    });

    // the ERA is looked up with the untagged client (clearing-house ERAs aren't tagged)
    expect(fetchById).toHaveBeenCalledWith(eraReadClient, 'PaymentReconciliation', 'era-1');
    const created = (oystehr.fhir.create as Mock).mock.calls[0][0] as DocumentReference;
    const { 'objectPath+': objectPath, action } = (oystehr.z3.getPresignedUrl as Mock).mock.calls[0][0];
    expect(action).toBe('upload');
    expect(objectPath).toMatch(/^era-attachments\/era-1\/[0-9a-f-]{36}-Paper_remit\.pdf$/);
    expect(created).toMatchObject({
      context: { related: [{ reference: 'PaymentReconciliation/era-1' }] },
      content: [
        {
          attachment: {
            url: `https://project-api.zapehr.com/v1/z3/project-id-billing-app/${objectPath}`,
            contentType: 'application/pdf',
            title: 'Paper remit.pdf',
          },
        },
      ],
    });
    expect(result).toEqual({ documentReferenceId: 'doc-new', uploadUrl: 'signed-url' });
  });

  it('only accepts PDFs and images for remit scans', async () => {
    (fetchById as Mock).mockResolvedValueOnce({ resourceType: 'PaymentReconciliation', id: 'era-1' });
    const oystehr = makeClient();
    await expect(
      addEraAttachment(oystehr, {} as Oystehr, {
        eraId: 'era-1',
        name: 'notes.docx',
        contentType: '',
        secrets: SECRETS,
      })
    ).rejects.toMatchObject({ message: "Files of type application/octet-stream can't be attached here" });
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('presigns a download only for a file of this ERA', async () => {
    (fetchById as Mock).mockResolvedValueOnce(scan());
    const oystehr = makeClient();
    await expect(
      downloadEraAttachment(oystehr, { eraId: 'era-1', documentReferenceId: 'doc-1', secrets: SECRETS })
    ).resolves.toEqual({ downloadUrl: 'signed-url' });
    expect(oystehr.z3.getPresignedUrl).toHaveBeenCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'era-attachments/era-1/abc-Remit.pdf',
      action: 'download',
    });

    (fetchById as Mock).mockResolvedValueOnce(scan());
    await expect(
      downloadEraAttachment(oystehr, { eraId: 'era-2', documentReferenceId: 'doc-1', secrets: SECRETS })
    ).rejects.toMatchObject({ message: 'DocumentReference doc-1 is not attached to PaymentReconciliation/era-2' });
  });

  it("won't reach a file outside the ERA's folder even when the record claims the ERA", async () => {
    (fetchById as Mock).mockResolvedValueOnce(
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
    await expect(
      downloadEraAttachment(makeClient(), { eraId: 'era-1', documentReferenceId: 'doc-1', secrets: SECRETS })
    ).rejects.toMatchObject({ message: 'Invalid Z3 URL in DocumentReference doc-1' });
  });

  it('deletes the stored file and the record, even when the upload never landed', async () => {
    (fetchById as Mock).mockResolvedValueOnce(scan());
    const oystehr = makeClient();
    (oystehr.z3.deleteObject as Mock).mockRejectedValueOnce(new Error('not found'));
    await expect(
      deleteEraAttachment(oystehr, { eraId: 'era-1', documentReferenceId: 'doc-1', secrets: SECRETS })
    ).resolves.toEqual({ deleted: true });
    expect(oystehr.fhir.delete).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: 'doc-1' });
  });

  it('renames the attachment title only', async () => {
    (fetchById as Mock).mockResolvedValueOnce(scan());
    const oystehr = makeClient();
    await renameEraAttachment(oystehr, {
      eraId: 'era-1',
      documentReferenceId: 'doc-1',
      name: 'Remit (UHC).pdf',
      secrets: SECRETS,
    });
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'DocumentReference',
      id: 'doc-1',
      operations: [
        {
          op: 'replace',
          path: '/content',
          value: [{ attachment: { url: STORED_URL, contentType: 'application/pdf', title: 'Remit (UHC).pdf' } }],
        },
      ],
    });
  });
});

describe('resolveAttachmentContentType', () => {
  it('prefers what the browser reported and falls back to the file name', () => {
    expect(resolveAttachmentContentType('scan.PDF', '')).toBe('application/pdf');
    expect(resolveAttachmentContentType('scan', 'image/png')).toBe('image/png');
    expect(resolveAttachmentContentType('scan.tif', undefined)).toBe('image/tiff');
    // browsers report some JPEGs with the non-standard type
    expect(resolveAttachmentContentType('scan.jpg', 'image/jpg')).toBe('image/jpeg');
    expect(resolveAttachmentContentType('notes.bin', undefined)).toBe('application/octet-stream');
  });
});
