import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/add-claim-attachment';
import { CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM, fetchById } from '../../../src/billing/shared';

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
      getPresignedUrl: vi.fn().mockResolvedValueOnce({ signedUrl: 'some-presigned-url' }),
    },
  } as unknown as Oystehr;
}

describe('add-claim-attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('succeeds creating doc ref, patches claim', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
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
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, {
        claimId: 'claim-id',
        name: 'File.new.pdf',
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' },
      })
    ).resolves.toEqual({ uploadUrl: 'some-presigned-url' });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        {
          method: 'POST',
          url: '/DocumentReference',
          resource: {
            resourceType: 'DocumentReference',
            status: 'current',
            date: expect.any(String),
            content: [
              {
                attachment: {
                  url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.new.pdf',
                  contentType: 'application/pdf',
                  title: 'File.new.pdf',
                },
              },
            ],
            context: {
              related: [
                {
                  reference: 'Claim/claim-id',
                },
              ],
            },
          },
          fullUrl: 'urn:uuid:doc-ref',
        },
        {
          method: 'PATCH',
          url: '/Claim/claim-id',
          operations: [
            {
              op: 'add',
              path: '/supportingInfo/-',
              value: {
                sequence: 2,
                category: {
                  coding: [
                    { system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory', code: 'attachment' },
                  ],
                },
                code: {
                  coding: [
                    {
                      system: CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
                      code: 'OZ',
                    },
                  ],
                },
                valueReference: {
                  reference: 'urn:uuid:doc-ref',
                },
              },
            },
          ],
        },
      ],
    });
    expect(oystehr.z3.getPresignedUrl).toBeCalledTimes(1);
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'claim-attachments/claim-id/File.new.pdf',
      action: 'upload',
    });
  });
  it('succeeds creating doc ref, patches claim with requested report type code', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
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
    });
    const oystehr = makeClient();
    await expect(
      performEffect(oystehr, {
        claimId: 'claim-id',
        name: 'File.new.pdf',
        reportTypeCode: 'RR',
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' },
      })
    ).resolves.toEqual({ uploadUrl: 'some-presigned-url' });
    expect(oystehr.fhir.transaction).toBeCalledTimes(1);
    expect(oystehr.fhir.transaction).toBeCalledWith({
      requests: [
        {
          method: 'POST',
          url: '/DocumentReference',
          resource: {
            resourceType: 'DocumentReference',
            status: 'current',
            date: expect.any(String),
            content: [
              {
                attachment: {
                  url: 'https://project-api.zapehr.com/v1/z3/project-id-billing-app/claim-attachments/claim-id/File.new.pdf',
                  contentType: 'application/pdf',
                  title: 'File.new.pdf',
                },
              },
            ],
            context: {
              related: [
                {
                  reference: 'Claim/claim-id',
                },
              ],
            },
          },
          fullUrl: 'urn:uuid:doc-ref',
        },
        {
          method: 'PATCH',
          url: '/Claim/claim-id',
          operations: [
            {
              op: 'add',
              path: '/supportingInfo/-',
              value: {
                sequence: 2,
                category: {
                  coding: [
                    { system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory', code: 'attachment' },
                  ],
                },
                code: {
                  coding: [
                    {
                      system: CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
                      code: 'RR',
                    },
                  ],
                },
                valueReference: {
                  reference: 'urn:uuid:doc-ref',
                },
              },
            },
          ],
        },
      ],
    });
    expect(oystehr.z3.getPresignedUrl).toBeCalledTimes(1);
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': 'claim-attachments/claim-id/File.new.pdf',
      action: 'upload',
    });
  });

  // The upload target and the URL recorded on the DocumentReference have to name the same object,
  // so a file name needing sanitizing must be sanitized for both.
  it('uploads to the same sanitized path it records on the document', async () => {
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce({
      resourceType: 'Claim',
      id: 'claim-id',
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
    });
    const oystehr = makeClient();

    await performEffect(oystehr, {
      claimId: 'claim-id',
      name: 'Timely Filing Report #7.pdf',
      secrets: {
        PROJECT_API: 'https://project-api.zapehr.com/v1',
        PROJECT_ID: 'project-id',
      },
    });

    const sanitizedPath = 'claim-attachments/claim-id/Timely_Filing_Report__7.pdf';
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': sanitizedPath,
      action: 'upload',
    });
    const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
    expect(requests[0].resource.content[0].attachment.url).toBe(
      `https://project-api.zapehr.com/v1/z3/project-id-billing-app/${sanitizedPath}`
    );
    // The human-readable title keeps the name the biller typed.
    expect(requests[0].resource.content[0].attachment.title).toBe('Timely Filing Report #7.pdf');
  });
});
