import Oystehr from '@oystehr/sdk';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/download-claim-attachment';
import { fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

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
      content: [],
    });
    const oystehr = makeClient();
    await expect(() =>
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: {} })
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
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: {} })
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
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: {} })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Invalid Z3 URL in DocumentReference document-reference-id",
      }
    `);
  });
  it('succeeds deleting z3 object and doc ref, patches claim', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      status: 'current',
      content: [
        {
          attachment: {
            url: 'https://project-api.zapehr.com/v1/z3/some-bucket/some-path/File.pdf',
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
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1' },
      })
    ).resolves.toEqual({ downloadUrl: 'some-presigned-url' });
    expect(oystehr.z3.getPresignedUrl).toBeCalledTimes(1);
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'some-bucket',
      'objectPath+': 'some-path/File.pdf',
      action: 'download',
    });
  });
});
