import Oystehr from '@oystehr/sdk';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/rename-claim-attachment';
import { fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

function makeClient(): Oystehr {
  return {
    fhir: {
      transaction: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('rename-claim-attachment', () => {
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
      performEffect(oystehr, { documentReferenceId: 'document-reference-id', name: 'File.new.pdf', secrets: {} })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Missing attachment information for DocumentReference document-reference-id",
      }
    `);
  });
  it('succeeds changing doc ref content title', async () => {
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
        documentReferenceId: 'document-reference-id',
        name: 'File.new.pdf',
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1' },
      })
    ).resolves.toBeUndefined();
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        {
          method: 'PATCH',
          url: '/DocumentReference/document-reference-id',
          operations: [
            {
              op: 'replace',
              path: '/content',
              value: [
                {
                  attachment: {
                    url: 'https://project-api.zapehr.com/v1/z3/some-bucket/some-path/File.pdf',
                    contentType: 'application/pdf',
                    title: 'File.new.pdf',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
