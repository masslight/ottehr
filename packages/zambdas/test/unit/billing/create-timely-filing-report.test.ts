import Oystehr from '@oystehr/sdk';
import { Claim, Provenance, Resource } from 'fhir/r4b';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
  ClaimAcknowledgmentEvent,
  ClaimTransmitEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimAcknowledgmentEvents, claimTransmitEvent } from '../../../src/billing/claim-acknowledgments';
import { performEffect, timelyFilingReportFileName } from '../../../src/billing/create-timely-filing-report';

const CLAIM_ID = 'claim-1';
const LAMBDA_RESPONSE_LIMIT_BYTES = 6 * 1024 * 1024;

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

describe('claimAcknowledgmentEvents', () => {
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

    const events = claimAcknowledgmentEvents({
      provenances: [acknowledgmentProvenance(later, 'b'), note, acknowledgmentProvenance(earlier, 'a')],
    });

    expect(events).toEqual([earlier, later]);
  });

  it('orders acknowledgments by instant, not by how the timestamp is written', () => {
    // 09:00-04:00 is 13:00Z — an hour after 12:00Z, but it sorts ahead of it as a string.
    const earlier = acknowledgment({
      responseId: 'id:1',
      eventTime: '2026-08-06T12:00:00.000Z',
    });
    const later = acknowledgment({
      responseId: 'id:2',
      eventTime: '2026-08-06T09:00:00-04:00',
    });

    const events = claimAcknowledgmentEvents({
      provenances: [acknowledgmentProvenance(later, 'b'), acknowledgmentProvenance(earlier, 'a')],
    });

    expect(events).toEqual([earlier, later]);
  });

  it('skips a record it cannot read rather than failing the report', () => {
    const broken = acknowledgmentProvenance(acknowledgment(), 'broken');
    broken.extension = [
      {
        url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
        valueString: 'not json',
      },
    ];

    const events = claimAcknowledgmentEvents({ provenances: [broken] });

    expect(events).toEqual([]);
  });
});

describe('claimTransmitEvent', () => {
  const transmitProvenance = (id: string, event: Partial<ClaimTransmitEvent>): Provenance =>
    ({
      resourceType: 'Provenance',
      id,
      recorded: event.transmittedAt,
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.submit],
      },
      target: [
        {
          reference: `Claim/${CLAIM_ID}`,
        },
      ],
      agent: [
        {
          who: {
            reference: 'Device/rules-engine',
          },
        },
      ],
      extension: [
        {
          url: CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
          valueString: JSON.stringify(event),
        },
      ],
    }) as Provenance;

  it('reads the batch and clearinghouse id off the transmit provenance', () => {
    const transmit = claimTransmitEvent({
      provenances: [
        transmitProvenance('submission', {
          transmittedAt: '2026-08-05T11:53:00.000Z',
          batchId: '20260805123456789',
          clearinghouseClaimId: '48213765',
        }),
      ],
      claimId: CLAIM_ID,
    });

    expect(transmit).toEqual({
      transmittedAt: '2026-08-05T11:53:00.000Z',
      batchId: '20260805123456789',
      clearinghouseClaimId: '48213765',
    });
  });

  it('picks the earliest transmit by instant', () => {
    // 08:54-04:00 is 12:54Z — an hour after 11:53Z, but it sorts ahead of it as a string.
    const earliest = transmitProvenance('earliest', { transmittedAt: '2026-08-05T11:53:00.000Z' });
    const resubmission = transmitProvenance('resubmission', { transmittedAt: '2026-08-05T08:54:00-04:00' });

    const transmit = claimTransmitEvent({
      provenances: [resubmission, earliest],
      claimId: CLAIM_ID,
    });

    expect(transmit).toMatchObject({ transmittedAt: '2026-08-05T11:53:00.000Z' });
  });

  // addErrorProvenanceForClaimSubmission records a failed submission under the same activity.
  it('ignores a submission-error provenance, which carries no transmit event', () => {
    const submissionError = {
      resourceType: 'Provenance',
      id: 'error',
      recorded: '2026-08-05T11:53:00.000Z',
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.submit],
      },
      target: [
        {
          reference: `Claim/${CLAIM_ID}`,
        },
      ],
      agent: [
        {
          who: {
            reference: 'Device/rules-engine',
          },
        },
      ],
    } as Provenance;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const transmit = claimTransmitEvent({
      provenances: [submissionError],
      claimId: CLAIM_ID,
    });

    expect(transmit).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Claim/${CLAIM_ID}`));
  });

  it('skips a transmit payload it cannot read rather than reporting a wrong date', () => {
    const broken = transmitProvenance('broken', { transmittedAt: '2026-08-05T11:53:00.000Z' });
    broken.extension = [
      {
        url: CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
        valueString: 'not json',
      },
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const transmit = claimTransmitEvent({
      provenances: [broken],
      claimId: CLAIM_ID,
    });

    expect(transmit).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Provenance/broken'));
  });

  it('returns nothing when the claim has no transmit provenance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const transmit = claimTransmitEvent({
      provenances: [acknowledgmentProvenance(acknowledgment(), 'a')],
      claimId: CLAIM_ID,
    });

    expect(transmit).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Claim/${CLAIM_ID}`));
  });
});

describe('timelyFilingReportFileName', () => {
  it('names the file after the patient control number, falling back to the claim', () => {
    expect(timelyFilingReportFileName(CLAIM_ID, 'Q78291-A')).toMatch(
      /^Timely_Filing_Report_Q78291-A_\d{8}_\d{6}\.pdf$/
    );
    expect(timelyFilingReportFileName(CLAIM_ID, undefined)).toMatch(/^Timely_Filing_Report_claim-1_\d{8}_\d{6}\.pdf$/);
  });
});

describe('create-timely-filing-report performEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeClients(billingClaim: Claim = claim): {
    oystehr: Oystehr;
    search: ReturnType<typeof vi.fn>;
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
    const transaction = vi.fn();
    const getPresignedUrl = vi.fn();
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
      search,
      transaction,
      getPresignedUrl,
    };
  }

  const params = {
    claimId: CLAIM_ID,
    secrets: {
      PROJECT_API: 'https://project-api.zapehr.com/v1',
      PROJECT_ID: 'project-id',
    },
  };

  it('hands back the rendered pdf inline, named after the patient control number', async () => {
    const { oystehr } = makeClients();

    const result = await performEffect({
      oystehr,
      params,
    });

    expect(result.fileName).toMatch(/^Timely_Filing_Report_Q78291-A_\d{8}_\d{6}\.pdf$/);
    expect(Buffer.from(result.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    // The bytes ride back in the response body, which a lambda caps at 6 MB.
    expect(result.pdfBase64.length).toBeLessThan(LAMBDA_RESPONSE_LIMIT_BYTES);
  });

  // The report is a snapshot of a trail the claim already owns. Storing it would leave a stale copy
  // behind and add an attachment the biller never asked to file.
  it('leaves no record behind — no upload, no write to the claim', async () => {
    const { oystehr, transaction, getPresignedUrl } = makeClients();

    await performEffect({
      oystehr,
      params,
    });

    expect(transaction).not.toHaveBeenCalled();
    expect(getPresignedUrl).not.toHaveBeenCalled();
  });

  // The acknowledgment trail and the transmit event both come from Provenances targeting the claim.
  it('reads the claim history once rather than searching per event kind', async () => {
    const { oystehr, search } = makeClients();

    await performEffect({
      oystehr,
      params,
    });

    const provenanceSearches = search.mock.calls.filter(([args]) => args.resourceType === 'Provenance');
    expect(provenanceSearches).toHaveLength(1);
  });
});
