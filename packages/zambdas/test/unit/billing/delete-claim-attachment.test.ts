import { FhirResourceReturnValue } from '@oystehr/sdk';
import { Claim, DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/delete-claim-attachment';
import { fetchById } from '../../../src/billing/shared';
import { OystehrMock } from '../../helpers/oystehr-mock';
import { claimHistoryRequest, historyChanges, TEST_AGENT } from './claim-history-fixtures';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

const SECRETS = { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' };

function makeClient(): OystehrMock {
  return {
    fhir: {
      transaction: vi.fn(),
      delete: vi.fn(),
    },
    z3: {
      deleteObject: vi.fn(),
    },
  } as unknown as OystehrMock;
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
        context: { related: [{ reference: 'Claim/claim-id' }] },
        content: [],
      });
    const oystehr = makeClient();
    await expect(() =>
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
        agent: TEST_AGENT,
      })
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
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
        agent: TEST_AGENT,
      })
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
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
        agent: TEST_AGENT,
      })
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
        agent: TEST_AGENT,
      })
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
        agent: TEST_AGENT,
      })
    ).resolves.toBeUndefined();
    expect(oystehr.z3.deleteObject).toBeCalledTimes(1);
    expect(oystehr.z3.deleteObject).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'claim-attachments/claim-id/File.pdf',
    });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        expect.objectContaining({
          method: 'PATCH',
          url: '/Claim/claim-id',
        }),
        expect.objectContaining({
          method: 'PATCH',
          url: '/DocumentReference/document-reference-id',
        }),
        claimHistoryRequest({
          target: 'DocumentReference/document-reference-id',
          claimId: 'claim-id',
          activity: CLAIM_PROVENANCE_ACTIVITY.delete,
        }),
      ],
    });
    expect(oystehr.fhir.delete).toBeCalledWith({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
    });
    const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
    expect(JSON.parse(atob(requests[0].resource.data))).toEqual([
      {
        op: 'replace',
        path: '/supportingInfo',
        value: [],
      },
    ]);
    expect(historyChanges(requests)).toEqual([
      {
        field: 'name',
        label: 'Name',
        previousValue: 'File.pdf',
        newValue: null,
      },
    ]);
    // the file goes only once nothing points at it
    expect((oystehr.fhir.transaction as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (oystehr.z3.deleteObject as Mock).mock.invocationCallOrder[0]
    );
  });
  it("keeps the file when the claim can't be updated, so the record never points at a missing file", async () => {
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
          { sequence: 1, category: { coding: [] }, valueReference: { reference: 'document-reference-id' } },
        ],
      })
      .mockResolvedValueOnce({
        resourceType: 'DocumentReference',
        id: 'document-reference-id',
        status: 'current',
        context: { related: [{ reference: 'Claim/claim-id' }] },
        content: [
          {
            attachment: {
              url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.pdf',
            },
          },
        ],
      });
    const oystehr = makeClient();
    (oystehr.fhir.transaction as Mock).mockRejectedValueOnce(new Error('precondition failed'));
    await expect(
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
        agent: TEST_AGENT,
      })
    ).rejects.toThrow('precondition failed');
    expect(oystehr.z3.deleteObject).not.toHaveBeenCalled();
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
        documentReferenceId: 'document-reference-id-2',
        secrets: SECRETS,
        agent: TEST_AGENT,
      })
    ).resolves.toBeUndefined();
    expect(oystehr.z3.deleteObject).toBeCalledTimes(1);
    expect(oystehr.z3.deleteObject).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'claim-attachments/claim-id/File.pdf',
    });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        expect.objectContaining({
          method: 'PATCH',
          url: '/Claim/claim-id',
        }),
        expect.objectContaining({
          method: 'PATCH',
          url: '/DocumentReference/document-reference-id-2',
        }),
        claimHistoryRequest({
          target: 'DocumentReference/document-reference-id-2',
          claimId: 'claim-id',
          activity: CLAIM_PROVENANCE_ACTIVITY.delete,
        }),
      ],
    });
    const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
    expect(JSON.parse(atob(requests[0].resource.data))).toEqual([
      {
        op: 'replace',
        path: '/supportingInfo',
        value: [
          {
            sequence: 1,
            category: {
              coding: [],
            },
            valueReference: {
              reference: 'document-reference-id-1',
            },
          },
          {
            sequence: 2,
            category: {
              coding: [],
            },
            valueReference: {
              reference: 'document-reference-id-3',
            },
          },
          {
            sequence: 3,
            category: {
              coding: [],
            },
            valueReference: {
              reference: 'document-reference-id-4',
            },
          },
        ],
      },
    ]);
  });

  describe('version lock', () => {
    const claim = (): FhirResourceReturnValue<Claim> => ({
      resourceType: 'Claim',
      id: 'claim-id',
      meta: {
        versionId: '6',
      },
      status: 'active',
      type: {
        coding: [],
      },
      created: DateTime.now().toISO(),
      insurance: [],
      patient: {
        reference: 'patient-id',
      },
      priority: {
        coding: [],
      },
      provider: {
        reference: 'organization-id',
      },
      use: 'claim',
      supportingInfo: [
        {
          sequence: 1,
          category: {
            coding: [],
          },
          valueReference: {
            reference: 'document-reference-id',
          },
        },
      ],
    });

    const attachment = (overrides: Partial<DocumentReference> = {}): FhirResourceReturnValue<DocumentReference> => ({
      resourceType: 'DocumentReference',
      id: 'document-reference-id',
      meta: {
        versionId: '3',
      },
      status: 'current',
      context: {
        related: [
          {
            reference: 'Claim/claim-id',
          },
        ],
      },
      content: [
        {
          attachment: {
            url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.pdf',
            title: 'File.pdf',
          },
        },
      ],
      ...overrides,
    });

    const deleteAttachment = (oystehr: OystehrMock): Promise<void> =>
      performEffect(oystehr, {
        claimId: 'claim-id',
        documentReferenceId: 'document-reference-id',
        secrets: SECRETS,
        agent: TEST_AGENT,
      });

    it('retires the document at the version its history was read at', async () => {
      (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce(claim()).mockResolvedValueOnce(attachment());
      const oystehr = makeClient();

      await deleteAttachment(oystehr);

      const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
      expect(requests[1]).toMatchObject({
        url: '/DocumentReference/document-reference-id',
        ifMatch: 'W/"3"',
      });
      expect(JSON.parse(atob(requests[1].resource.data))).toEqual([
        {
          op: 'replace',
          path: '/status',
          value: 'entered-in-error',
        },
      ]);
    });

    const versionConflict = (): Error =>
      Object.assign(new Error('Precondition Failed'), {
        code: 412,
      });

    it('records the name a document renamed after it was read had when it was deleted', async () => {
      (fetchById as Mock<typeof fetchById>)
        .mockResolvedValueOnce(claim())
        .mockResolvedValueOnce(attachment())
        .mockResolvedValueOnce(claim())
        .mockResolvedValueOnce(
          attachment({
            meta: {
              versionId: '4',
            },
            content: [
              {
                attachment: {
                  url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.pdf',
                  title: 'Renamed.pdf',
                },
              },
            ],
          })
        );
      const oystehr = makeClient();
      (oystehr.fhir.transaction as Mock).mockRejectedValueOnce(versionConflict());

      await deleteAttachment(oystehr);

      const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[1];
      expect(requests[1]).toMatchObject({
        ifMatch: 'W/"4"',
      });
      expect(historyChanges(requests)).toEqual([
        {
          field: 'name',
          label: 'Name',
          previousValue: 'Renamed.pdf',
          newValue: null,
        },
      ]);
      expect(oystehr.fhir.delete).toHaveBeenCalledTimes(1);
    });

    it('keeps an attachment added to the claim after it was read', async () => {
      const added = {
        sequence: 2,
        category: {
          coding: [],
        },
        valueReference: {
          reference: 'other-document-reference-id',
        },
      };
      (fetchById as Mock<typeof fetchById>)
        .mockResolvedValueOnce(claim())
        .mockResolvedValueOnce(attachment())
        .mockResolvedValueOnce({
          ...claim(),
          meta: {
            versionId: '7',
          },
          supportingInfo: [...(claim().supportingInfo ?? []), added],
        })
        .mockResolvedValueOnce(attachment());
      const oystehr = makeClient();
      (oystehr.fhir.transaction as Mock).mockRejectedValueOnce(versionConflict());

      await deleteAttachment(oystehr);

      const [{ requests: first }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
      const [{ requests: retried }] = (oystehr.fhir.transaction as Mock).mock.calls[1];
      expect(first[0]).toMatchObject({
        url: '/Claim/claim-id',
        ifMatch: 'W/"6"',
      });
      expect(retried[0]).toMatchObject({
        url: '/Claim/claim-id',
        ifMatch: 'W/"7"',
      });
      expect(JSON.parse(atob(retried[0].resource.data))).toEqual([
        {
          op: 'replace',
          path: '/supportingInfo',
          value: [
            {
              ...added,
              sequence: 1,
            },
          ],
        },
      ]);
    });

    it('finishes a deletion that retired the document but failed to remove it', async () => {
      (fetchById as Mock<typeof fetchById>)
        .mockResolvedValueOnce({
          ...claim(),
          supportingInfo: [],
        })
        .mockResolvedValueOnce(
          attachment({
            status: 'entered-in-error',
          })
        );
      const oystehr = makeClient();

      await deleteAttachment(oystehr);

      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
      expect(oystehr.fhir.delete).toBeCalledWith({
        resourceType: 'DocumentReference',
        id: 'document-reference-id',
      });
      expect(oystehr.z3.deleteObject).toBeCalledTimes(1);
    });
  });
});
