import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Provenance, Resource } from 'fhir/r4b';
import {
  CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
  RAW_REQUEST_EXTENSION_URL,
  RAW_RESPONSE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY,
  ClaimAcknowledgmentEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchClaimAcknowledgmentEvents, fetchClaimTransmitEvent } from '../../../src/billing/claim-acknowledgments';
import { performEffect, timelyFilingReportFileName } from '../../../src/billing/create-timely-filing-report';

const { uploadObjectToZ3Mock } = vi.hoisted(() => ({ uploadObjectToZ3Mock: vi.fn() }));
vi.mock('../../../src/shared/z3Utils', () => ({ uploadObjectToZ3: uploadObjectToZ3Mock }));

const CLAIM_ID = 'claim-1';

const claim: Claim = {
  resourceType: 'Claim',
  id: CLAIM_ID,
  status: 'active',
  use: 'claim',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  patient: {
    reference: 'Patient/patient-1',
  },
  created: '2026-08-05T12:00:00Z',
  provider: {
    reference: 'Organization/provider-1',
  },
  priority: {
    coding: [
      {
        code: 'normal',
      },
    ],
  },
  insurance: [
    {
      sequence: 1,
      focal: true,
      coverage: {
        reference: 'Coverage/coverage-1',
      },
    },
  ],
  identifier: [
    {
      system: 'https://identifiers.fhir.oystehr.com/rcm-claim-patient-control-number',
      value: 'Q78291-A',
    },
  ],
  item: [
    {
      sequence: 1,
      productOrService: {},
      servicedDate: '2026-08-05',
    },
  ],
  total: {
    value: 627,
  },
};

const acknowledgment = (overrides: Partial<ClaimAcknowledgmentEvent> = {}): ClaimAcknowledgmentEvent => ({
  source: 'claimmd',
  entityName: 'CIGNA',
  entityKind: 'payer',
  message: 'Code 19 - Entity acknowledges receipt of claim/encounter.',
  responseId: 'id:9001',
  eventTime: '2026-08-05T15:02:00Z',
  ...overrides,
});

const acknowledgmentProvenance = (event: ClaimAcknowledgmentEvent, id: string): Provenance =>
  ({
    resourceType: 'Provenance',
    id,
    recorded: event.eventTime,
    activity: {
      coding: [CLAIM_PROVENANCE_ACTIVITY.acknowledgment],
    },
    target: [
      {
        reference: `ClaimResponse/cr-${id}`,
      },
      {
        reference: `Claim/${CLAIM_ID}`,
      },
    ],
    agent: [
      {
        who: {
          reference: 'Device/system',
        },
      },
    ],
    extension: [
      {
        url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
        valueString: JSON.stringify(event),
      },
    ],
  }) as Provenance;

const pagedBundle = (resources: Resource[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  entry: resources.map((resource) => ({
    resource,
    search: {
      mode: 'match',
    },
  })),
  total: resources.length,
  unbundle: () => resources,
});

describe('fetchClaimAcknowledgmentEvents', () => {
  it('returns acknowledgments oldest first and ignores other history', () => {
    const later = acknowledgment({
      responseId: 'id:2',
      eventTime: '2026-08-06T12:47:00Z',
    });
    const earlier = acknowledgment({
      responseId: 'id:1',
      eventTime: '2026-08-05T13:14:00Z',
    });
    const note = {
      resourceType: 'Provenance',
      id: 'note',
      recorded: '2026-08-05T14:00:00Z',
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.note],
      },
      target: [
        {
          reference: `Claim/${CLAIM_ID}`,
        },
      ],
      agent: [
        {
          who: {
            reference: 'Practitioner/u1',
          },
        },
      ],
    } as Provenance;
    const search = vi
      .fn()
      .mockResolvedValue(
        pagedBundle([acknowledgmentProvenance(later, 'b'), note, acknowledgmentProvenance(earlier, 'a')])
      );

    return expect(
      fetchClaimAcknowledgmentEvents({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toEqual([earlier, later]);
  });

  it('orders acknowledgments by instant, not by how the timestamp is written', async () => {
    // 09:00-04:00 is 13:00Z — an hour after 12:00Z, but it sorts ahead of it as a string.
    const earlier = acknowledgment({
      responseId: 'id:1',
      eventTime: '2026-08-06T12:00:00.000Z',
    });
    const later = acknowledgment({
      responseId: 'id:2',
      eventTime: '2026-08-06T09:00:00-04:00',
    });
    const search = vi
      .fn()
      .mockResolvedValue(pagedBundle([acknowledgmentProvenance(later, 'b'), acknowledgmentProvenance(earlier, 'a')]));

    await expect(
      fetchClaimAcknowledgmentEvents({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toEqual([earlier, later]);
  });

  it('skips a record it cannot read rather than failing the report', async () => {
    const broken = acknowledgmentProvenance(acknowledgment(), 'broken');
    broken.extension = [
      {
        url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
        valueString: 'not json',
      },
    ];
    const search = vi.fn().mockResolvedValue(pagedBundle([broken]));

    await expect(
      fetchClaimAcknowledgmentEvents({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toEqual([]);
  });
});

describe('fetchClaimTransmitEvent', () => {
  const submissionResponse = (): ClaimResponse =>
    ({
      resourceType: 'ClaimResponse',
      id: 'submission',
      status: 'active',
      created: '2026-08-05T11:53:00Z',
      request: {
        reference: `Claim/${CLAIM_ID}`,
      },
      extension: [
        {
          url: RAW_REQUEST_EXTENSION_URL,
          valueString: 'ISA*...',
        },
        {
          url: RAW_RESPONSE_EXTENSION_URL,
          valueString: JSON.stringify({
            batchid: '20260805123456789',
            claimmd_id: '48213765',
            response_time: '2026-08-05 07:53:00AM',
          }),
        },
      ],
    }) as ClaimResponse;

  it('reads the batch and clearinghouse id off the submission response', async () => {
    const search = vi.fn().mockResolvedValue(pagedBundle([submissionResponse()]));

    await expect(
      fetchClaimTransmitEvent({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toEqual({
      transmittedAt: '2026-08-05T11:53:00.000Z',
      batchId: '20260805123456789',
      clearinghouseClaimId: '48213765',
    });
  });

  it('picks the earliest submission by instant', async () => {
    const submissionAt = (id: string, created: string, responseTime: string): ClaimResponse =>
      ({
        ...submissionResponse(),
        id,
        created,
        extension: [
          {
            url: RAW_REQUEST_EXTENSION_URL,
            valueString: 'ISA*...',
          },
          {
            url: RAW_RESPONSE_EXTENSION_URL,
            valueString: JSON.stringify({ response_time: responseTime }),
          },
        ],
      }) as ClaimResponse;
    // 08:54-04:00 is 12:54Z — an hour after 11:53Z, but it sorts ahead of it as a string.
    const earliest = submissionAt('earliest', '2026-08-05T11:53:00.000Z', '2026-08-05 07:53:00AM');
    const resubmission = submissionAt('resubmission', '2026-08-05T08:54:00-04:00', '2026-08-05 08:54:00AM');
    const search = vi.fn().mockResolvedValue(pagedBundle([resubmission, earliest]));

    await expect(
      fetchClaimTransmitEvent({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toMatchObject({
      transmittedAt: '2026-08-05T11:53:00.000Z',
    });
  });

  // A status response can carry a raw response of its own, so the raw-request extension alone does
  // not separate the two feeds.
  it('ignores a status response even when it carries a raw request', async () => {
    const statusResponse = {
      ...submissionResponse(),
      id: 'status',
      identifier: [
        {
          system: CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
          value: 'account:9001',
        },
      ],
    } as ClaimResponse;
    const search = vi.fn().mockResolvedValue(pagedBundle([statusResponse]));

    await expect(
      fetchClaimTransmitEvent({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toBeUndefined();
  });

  it('still dates the transmit event when the raw response is unreadable', async () => {
    const noRawResponse = {
      ...submissionResponse(),
      extension: [
        {
          url: RAW_REQUEST_EXTENSION_URL,
          valueString: 'ISA*...',
        },
      ],
    } as ClaimResponse;
    const search = vi.fn().mockResolvedValue(pagedBundle([noRawResponse]));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      fetchClaimTransmitEvent({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toEqual({ transmittedAt: '2026-08-05T11:53:00Z' });
    // Silently dropping the ids would leave an unexplained gap in the report.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ClaimResponse/submission'));
  });

  it('ignores status responses, which carry no submitted 837', async () => {
    const statusResponse = {
      resourceType: 'ClaimResponse',
      id: 'status',
      status: 'active',
      created: '2026-08-05T15:02:00Z',
      request: {
        reference: `Claim/${CLAIM_ID}`,
      },
      extension: [
        {
          url: RAW_RESPONSE_EXTENSION_URL,
          valueString: '{"status":"A"}',
        },
      ],
    } as ClaimResponse;
    const search = vi.fn().mockResolvedValue(pagedBundle([statusResponse]));

    await expect(
      fetchClaimTransmitEvent({
        oystehr: {
          fhir: {
            search,
          },
        } as unknown as Oystehr,
        claimId: CLAIM_ID,
      })
    ).resolves.toBeUndefined();
  });
});

describe('timelyFilingReportFileName', () => {
  it('names the file after the patient control number, falling back to the claim', () => {
    expect(timelyFilingReportFileName(CLAIM_ID, 'Q78291-A')).toMatch(
      /^Timely_Filing_Report_Q78291-A_\d{8}_\d{4}\.pdf$/
    );
    expect(timelyFilingReportFileName(CLAIM_ID, undefined)).toMatch(/^Timely_Filing_Report_claim-1_\d{8}_\d{4}\.pdf$/);
  });
});

describe('create-timely-filing-report performEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeClients(billingClaim: Claim = claim): {
    oystehr: Oystehr;
    eraReadClient: Oystehr;
    transaction: ReturnType<typeof vi.fn>;
    getPresignedUrl: ReturnType<typeof vi.fn>;
  } {
    const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Claim') return Promise.resolve(pagedBundle([billingClaim]));
      if (resourceType === 'Provenance') {
        return Promise.resolve(pagedBundle([acknowledgmentProvenance(acknowledgment(), 'a')]));
      }
      return Promise.resolve(pagedBundle([]));
    });
    const transaction = vi.fn().mockResolvedValue({
      entry: [
        {
          resource: {
            resourceType: 'DocumentReference',
            id: 'doc-1',
          },
        },
      ],
    });
    const getPresignedUrl = vi
      .fn()
      .mockResolvedValueOnce({ signedUrl: 'https://z3/upload' })
      .mockResolvedValueOnce({ signedUrl: 'https://z3/download' });
    const client = {
      fhir: {
        search,
        transaction,
        batch: vi.fn().mockResolvedValue({
          resourceType: 'Bundle',
          type: 'batch-response',
          entry: [],
        }),
      },
      z3: {
        getPresignedUrl,
      },
      rcm: {
        getPayerByUrl: vi.fn(),
      },
    } as unknown as Oystehr;
    return {
      oystehr: client,
      eraReadClient: client,
      transaction,
      getPresignedUrl,
    };
  }

  // The upload path is sanitized inside attachClaimDocument. Rebuilding the download path from the
  // raw file name signs a URL for an object that was never written.
  it('signs the download for the same object it uploaded when the pcn needs sanitizing', async () => {
    const { oystehr, eraReadClient, getPresignedUrl } = makeClients({
      ...claim,
      identifier: [
        {
          system: 'https://identifiers.fhir.oystehr.com/rcm-claim-patient-control-number',
          value: 'Q7 8291#A',
        },
      ],
    });

    await performEffect({
      oystehr,
      eraReadClient,
      params: {
        claimId: CLAIM_ID,
        secrets: {
          PROJECT_API: 'https://project-api.zapehr.com/v1',
          PROJECT_ID: 'project-id',
        },
      },
    });

    const [[upload], [download]] = getPresignedUrl.mock.calls;
    expect(upload.action).toBe('upload');
    expect(download.action).toBe('download');
    expect(download['objectPath+']).toBe(upload['objectPath+']);
    expect(upload['objectPath+']).toMatch(/^claim-attachments\/claim-1\/Timely_Filing_Report_Q7_8291_A_/);
  });

  // A transaction entry may report the write as an absolute location with no inline resource.
  // Reading fixed positions out of it misses the id after the write has already committed.
  it('reads the document id from an absolute location url', async () => {
    const { oystehr, eraReadClient, transaction } = makeClients();
    transaction.mockResolvedValue({
      entry: [
        {
          response: {
            location: 'https://fhir-api.zapehr.com/r4/DocumentReference/doc-9/_history/1',
          },
        },
      ],
    });

    await expect(
      performEffect({
        oystehr,
        eraReadClient,
        params: {
          claimId: CLAIM_ID,
          secrets: {
            PROJECT_API: 'https://project-api.zapehr.com/v1',
            PROJECT_ID: 'project-id',
          },
        },
      })
    ).resolves.toMatchObject({ documentReferenceId: 'doc-9' });
  });

  it('attaches the rendered report to the claim and hands back a download link', async () => {
    const { oystehr, eraReadClient, transaction } = makeClients();

    const result = await performEffect({
      oystehr,
      eraReadClient,
      params: {
        claimId: CLAIM_ID,
        secrets: {
          PROJECT_API: 'https://project-api.zapehr.com/v1',
          PROJECT_ID: 'project-id',
        },
      },
    });

    expect(result).toEqual({
      downloadUrl: 'https://z3/download',
      documentReferenceId: 'doc-1',
      fileName: expect.stringMatching(/^Timely_Filing_Report_Q78291-A_\d{8}_\d{4}\.pdf$/),
    });
    // The claim gains a supportingInfo entry pointing at the new DocumentReference.
    const [{ requests }] = transaction.mock.calls[0];
    expect(requests.map((request: { method: string }) => request.method)).toEqual(['POST', 'PATCH']);
    // The PDF bytes are what gets uploaded, to the presigned URL the attachment returned.
    const [bytes, uploadUrl] = uploadObjectToZ3Mock.mock.calls[0];
    expect(uploadUrl).toBe('https://z3/upload');
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('fails loudly when the attachment did not produce a document to return', async () => {
    const { oystehr, eraReadClient, transaction } = makeClients();
    transaction.mockResolvedValue({ entry: [] });

    await expect(
      performEffect({
        oystehr,
        eraReadClient,
        params: {
          claimId: CLAIM_ID,
          secrets: {
            PROJECT_API: 'https://project-api.zapehr.com/v1',
            PROJECT_ID: 'project-id',
          },
        },
      })
    ).rejects.toThrow(/Could not record the timely filing report/);
    expect(uploadObjectToZ3Mock).not.toHaveBeenCalled();
  });
});
