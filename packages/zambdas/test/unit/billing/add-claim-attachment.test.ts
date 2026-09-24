import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/add-claim-attachment';
import { CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM, fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

// each upload gets its own random folder-local prefix, so equal names never overwrite each other
const OBJECT_PATH = /^claim-attachments\/claim-id\/[0-9a-f-]{36}-File\.new\.pdf$/;
const STORED_URL = new RegExp(
  `^https://project-api\\.zapehr\\.com/v1/z3/project-id-billing-app/${OBJECT_PATH.source.slice(1)}`
);

function makeClient(): Oystehr {
  return {
    fhir: {
      transaction: vi.fn().mockResolvedValue({
        unbundle: () => [{ resourceType: 'DocumentReference', id: 'new-document-reference-id' }],
      }),
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
    ).resolves.toEqual({ documentReferenceId: 'new-document-reference-id', uploadUrl: 'some-presigned-url' });
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
                  url: expect.stringMatching(STORED_URL),
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
      'objectPath+': expect.stringMatching(OBJECT_PATH),
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
    ).resolves.toEqual({ documentReferenceId: 'new-document-reference-id', uploadUrl: 'some-presigned-url' });
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
                  url: expect.stringMatching(STORED_URL),
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
      'objectPath+': expect.stringMatching(OBJECT_PATH),
      action: 'upload',
    });
  });

  it('stores and uploads to the same sanitized path, typed from the browser', async () => {
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
    });
    const oystehr = makeClient();
    await performEffect(oystehr, {
      claimId: 'claim-id',
      name: 'Op note #2.png',
      contentType: 'image/png',
      secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' },
    });
    const { requests } = (oystehr.fhir.transaction as Mock).mock.calls[0][0];
    const attachment = requests[0].resource.content[0].attachment;
    const { 'objectPath+': objectPath } = (oystehr.z3.getPresignedUrl as Mock).mock.calls[0][0];
    expect(objectPath).toMatch(/^claim-attachments\/claim-id\/[0-9a-f-]{36}-Op_note__2\.png$/);
    expect(attachment).toEqual({
      url: `https://project-api.zapehr.com/v1/z3/project-id-billing-app/${objectPath}`,
      contentType: 'image/png',
      title: 'Op note #2.png',
    });
  });
});
