import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Mock, vi } from 'vitest';
import { performEffect } from '../../../src/billing/add-claim-attachment';
import { CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM, fetchById } from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

// each upload gets its own random prefix, so files with the same name never overwrite each other
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
        name: 'My Title',
        fileName: 'File.new.pdf',
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
                  title: 'My Title',
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
        name: 'File Name',
        fileName: 'File.new.pdf',
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
                  title: 'File Name',
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
      name: 'Timely Filing Report #7',
      fileName: 'Timely Filing Report #7.pdf',
      secrets: {
        PROJECT_API: 'https://project-api.zapehr.com/v1',
        PROJECT_ID: 'project-id',
      },
    });

    const { 'objectPath+': objectPath } = (oystehr.z3.getPresignedUrl as Mock).mock.calls[0][0];
    expect(objectPath).toMatch(/^claim-attachments\/claim-id\/[0-9a-f-]{36}-Timely_Filing_Report__7\.pdf$/);
    expect(oystehr.z3.getPresignedUrl).toBeCalledWith({
      bucketName: 'project-id-billing-app',
      'objectPath+': objectPath,
      action: 'upload',
    });
    const [{ requests }] = (oystehr.fhir.transaction as Mock).mock.calls[0];
    expect(requests[0].resource.content[0].attachment.url).toBe(
      `https://project-api.zapehr.com/v1/z3/project-id-billing-app/${objectPath}`
    );
    // The human-readable title keeps the name the biller typed.
    expect(requests[0].resource.content[0].attachment.title).toBe('Timely Filing Report #7');
  });

  it("types the document from the browser, else from the file's own name", async () => {
    const claim = {
      resourceType: 'Claim' as const,
      id: 'claim-id',
      status: 'active' as const,
      type: { coding: [] },
      created: DateTime.now().toISO(),
      insurance: [],
      patient: { reference: 'patient-id' },
      priority: { coding: [] },
      provider: { reference: 'organization-id' },
      use: 'claim' as const,
    };
    const secrets = { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' };
    const attachmentOf = (oystehr: Oystehr): { contentType: string } =>
      (oystehr.fhir.transaction as Mock).mock.calls[0][0].requests[0].resource.content[0].attachment;

    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce(claim);
    const reported = makeClient();
    await performEffect(reported, {
      claimId: 'claim-id',
      name: 'Op note',
      fileName: 'op-note.png',
      mimeType: 'image/png',
      secrets,
    });
    expect(attachmentOf(reported).contentType).toBe('image/png');

    // the title has no extension; the file name still says what the file is
    (fetchById as Mock<typeof fetchById>).mockResolvedValueOnce(claim);
    const guessed = makeClient();
    await performEffect(guessed, { claimId: 'claim-id', name: 'Scan', fileName: 'scan.jpeg', secrets });
    expect(attachmentOf(guessed).contentType).toBe('image/jpeg');
  });

  it('fails rather than hand out an upload for a record the server returned without an id', async () => {
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
    (oystehr.fhir.transaction as Mock).mockResolvedValueOnce({
      unbundle: () => [{ resourceType: 'DocumentReference' }],
    });
    await expect(
      performEffect(oystehr, {
        claimId: 'claim-id',
        name: 'Op note',
        fileName: 'op-note.pdf',
        secrets: { PROJECT_API: 'https://project-api.zapehr.com/v1', PROJECT_ID: 'project-id' },
      })
    ).rejects.toThrow('The claim attachment was created without an id');
    expect(oystehr.z3.getPresignedUrl).not.toHaveBeenCalled();
  });
});
