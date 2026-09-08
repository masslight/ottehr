import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/delete-claim-attachment';
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
    z3: {
      deleteObject: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('delete-claim-attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('fails on empty content', async () => {
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
      })
      .mockResolvedValueOnce({
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
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
      })
      .mockResolvedValueOnce({
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
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
      })
      .mockResolvedValueOnce({
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
  it('fails on claim does not reference doc ref', async () => {
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
      })
      .mockResolvedValueOnce({
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
      performEffect(oystehr, { claimId: 'claim-id', documentReferenceId: 'document-reference-id', secrets: {} })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      {
        "code": 4340,
        "message": "Missing "Claim.supportingInfo" reference to DocumentReference document-reference-id",
      }
    `);
  });
  it('succeeds deleting z3 object and doc ref, patches claim', async () => {
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
        supportingInfo: [
          {
            sequence: 1,
            category: { coding: [] },
            valueReference: {
              reference: 'document-reference-id',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
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
    ).resolves.toBeUndefined();
    expect(oystehr.z3.deleteObject).toBeCalledTimes(1);
    expect(oystehr.z3.deleteObject).toBeCalledWith({ bucketName: 'some-bucket', 'objectPath+': 'some-path/File.pdf' });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        {
          method: 'PATCH',
          url: '/Claim/claim-id',
          operations: [
            {
              op: 'replace',
              path: '/supportingInfo',
              value: [],
            },
          ],
        },
        {
          method: 'DELETE',
          url: '/DocumentReference/document-reference-id',
        },
      ],
    });
  });
  it('succeeds by patching claim and renumbering supporting info', async () => {
    (fetchById as Mock<typeof fetchById>)
      .mockResolvedValueOnce({
        resourceType: 'Claim',
        id: 'claim-id',
        status: 'active',
        type: { coding: [] },
        created: DateTime.now().toISO(),
        insurance: [],
        patient: { reference: 'patient-id' },
        priority: { coding: [] },
        provider: { reference: 'organization-id' },
        use: 'claim',
        supportingInfo: [
          {
            sequence: 1,
            category: { coding: [] },
            valueReference: {
              reference: 'document-reference-id-1',
            },
          },
          {
            sequence: 2,
            category: { coding: [] },
            valueReference: {
              reference: 'document-reference-id-2',
            },
          },
          {
            sequence: 3,
            category: { coding: [] },
            valueReference: {
              reference: 'document-reference-id-3',
            },
          },
          {
            sequence: 4,
            category: { coding: [] },
            valueReference: {
              reference: 'document-reference-id-4',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        resourceType: 'DocumentReference',
        id: 'document-reference-id-2',
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
        documentReferenceId: 'document-reference-id-2',
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1' },
      })
    ).resolves.toBeUndefined();
    expect(oystehr.z3.deleteObject).toBeCalledTimes(1);
    expect(oystehr.z3.deleteObject).toBeCalledWith({ bucketName: 'some-bucket', 'objectPath+': 'some-path/File.pdf' });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        {
          method: 'PATCH',
          url: '/Claim/claim-id',
          operations: [
            {
              op: 'replace',
              path: '/supportingInfo',
              value: [
                {
                  sequence: 1,
                  category: { coding: [] },
                  valueReference: {
                    reference: 'document-reference-id-1',
                  },
                },
                {
                  sequence: 2,
                  category: { coding: [] },
                  valueReference: {
                    reference: 'document-reference-id-3',
                  },
                },
                {
                  sequence: 3,
                  category: { coding: [] },
                  valueReference: {
                    reference: 'document-reference-id-4',
                  },
                },
              ],
            },
          ],
        },
        {
          method: 'DELETE',
          url: '/DocumentReference/document-reference-id-2',
        },
      ],
    });
  });
});
