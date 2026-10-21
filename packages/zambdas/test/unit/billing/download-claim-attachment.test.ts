import Oystehr from '@oystehr/sdk';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/download-claim-attachment';
import { fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

const SECRETS = { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' };

function makeClient(): Oystehr {
  return {
    z3: {
      getPresignedUrl: vi.fn().mockResolvedValueOnce({ signedUrl: 'some-presigned-url' }),
    },
  } as unknown as Oystehr;
}

describe('download-claim-attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('fails on empty content', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/claim-id' }] },
      content: [],
    });
    const oystehr = makeClient();
    await expect(() =>
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: SECRETS })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Missing z3 URL in DocumentReference document-reference-id",
      }
    `);
  });
  it('fails on content does not have an url', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/claim-id' }] },
      content: [
        {
          attachment: {
            contentType: 'application/pdf',
            title: 'File.pdf',
          },
        },
      ],
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: SECRETS })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Missing z3 URL in DocumentReference document-reference-id",
      }
    `);
  });
  it('fails on invalid content url', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/claim-id' }] },
      content: [
        {
          attachment: {
            url: 'something-that-is-not-an-url',
            contentType: 'application/pdf',
            title: 'File.pdf',
          },
        },
      ],
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: SECRETS })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Invalid Z3 URL in DocumentReference document-reference-id",
      }
    `);
  });
  it('presigns a download of the claim attachment', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/claim-id' }] },
      content: [
        {
          attachment: {
            url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.pdf',
            contentType: 'application/pdf',
            title: 'File.pdf',
          },
        },
      ],
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
      })
    ).resolves.toEqual({ downloadUrl: 'some-presigned-url' });
    expect(oystehr.z3.getPresignedUrl).toBeCalledTimes(1);
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'claim-attachments/claim-id/File.pdf',
      action: 'download',
    });
  });

  it('refuses a document attached to another claim', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/other-claim' }] },
      content: [
        {
          attachment: {
            url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/other-claim/File.pdf',
          },
        },
      ],
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: SECRETS })
    ).rejects.toMatchObject({ message: 'DocumentReference document-reference-id is not attached to Claim/claim-id' });
    expect(oystehr.z3.getPresignedUrl).not.toHaveBeenCalled();
  });
  it('refuses a file outside the claim folder of the billing app bucket', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      context: { related: [{ reference: 'Claim/claim-id' }] },
      content: [{ attachment: { url: 'https://project-api.zapehr.com/v1/z3/project-id-patient-photos/p1/File.pdf' } }],
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: SECRETS })
    ).rejects.toMatchObject({ message: 'Invalid Z3 URL in DocumentReference document-reference-id' });
    expect(oystehr.z3.getPresignedUrl).not.toHaveBeenCalled();
  });
});
