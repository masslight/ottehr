import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Provenance, Resource } from 'fhir/r4b';
import {
  BILLING_RESOURCE_TAG,
  CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
  RAW_RESPONSE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillClaimStatusHistory } from '../../../src/scripts/backfill-claim-status-history.helpers';

vi.mock('../../../src/billing/provenance', async (importActual) => ({
  ...(await importActual<typeof import('../../../src/billing/provenance')>()),
  resolveClaimActor: vi.fn().mockResolvedValue({ who: { reference: 'Device/system' } }),
}));

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
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
  created: '2026-08-01T12:00:00Z',
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
  meta: {
    versionId: '3',
    tag: [
      BILLING_RESOURCE_TAG,
      ...claimStatusValuesToTags({
        arStage: AR_STAGE.patient,
      }),
    ],
  },
};

const claimResponse = (id: string, messages: unknown[]): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id,
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
  insurer: {
    reference: 'Organization/payer-1',
  },
  created: '2026-08-06T12:47:00Z',
  outcome: 'queued',
  request: {
    reference: 'Claim/claim-1',
  },
  meta: {
    versionId: '1',
  },
  identifier: [
    {
      system: CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
      value: `account:${id}`,
    },
  ],
  extension: [
    {
      url: RAW_RESPONSE_EXTENSION_URL,
      valueString: JSON.stringify({
        status: 'A',
        sender_name: 'CIGNA',
        response_time: '2026-08-06 08:47:00AM',
        messages,
      }),
    },
  ],
});

const pagedBundle = (resources: Resource[]): unknown => ({
  entry: resources.map((resource) => ({
    resource,
    search: {
      mode: 'match',
    },
  })),
  total: resources.length,
  unbundle: () => resources,
});

function makeClients(responses: ClaimResponse[]): {
  projectClient: Oystehr;
  billingClient: Oystehr;
  search: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockImplementation(
    ({
      resourceType,
      params,
    }: {
      resourceType: string;
      params: {
        name: string;
        value: string;
      }[];
    }) => {
      if (resourceType === 'ClaimResponse') {
        // The scan reads them all; complexValidation then re-reads one by id.
        const id = params.find((param) => param.name === '_id')?.value;
        return Promise.resolve(pagedBundle(id ? responses.filter((response) => response.id === id) : responses));
      }
      if (resourceType === 'Claim') return Promise.resolve(pagedBundle([claim]));
      return Promise.resolve(pagedBundle([]));
    }
  );
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const projectClient = {
    fhir: {
      search,
    },
  } as unknown as Oystehr;
  const billingClient = {
    fhir: {
      search,
      transaction,
    },
  } as unknown as Oystehr;
  return {
    projectClient,
    billingClient,
    search,
    transaction,
  };
}

// The scan drives everything else, so its filters are what keep a re-run cheap.
describe('backfillClaimStatusHistory scan', () => {
  it('reads only unprocessed status responses, using the untagged client', async () => {
    const { projectClient, billingClient, search } = makeClients([]);

    await backfillClaimStatusHistory({
      projectClient,
      billingClient,
      secrets: null as never,
      dryRun: false,
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'ClaimResponse',
        params: expect.arrayContaining([
          {
            name: 'identifier',
            value: `${CLAIM_STATUS_RESPONSE_EVENT_SYSTEM}|`,
          },
          {
            name: '_tag:not',
            value: `${CLAIM_STATUS_PROCESSED_TAG.system}|${CLAIM_STATUS_PROCESSED_TAG.code}`,
          },
        ]),
      })
    );
  });
});

describe('backfillClaimStatusHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes history for each unprocessed response', async () => {
    const responses = [
      claimResponse('9001', [
        {
          status: 'A',
          responseid: '9001',
          message: 'Acknowledged',
        },
      ]),
      claimResponse('9002', [
        {
          status: 'A',
          responseid: '9002',
          message: 'Accepted for processing',
        },
      ]),
    ];
    const { projectClient, billingClient, transaction } = makeClients(responses);

    const stats = await backfillClaimStatusHistory({
      projectClient,
      billingClient,
      secrets: null as never,
      dryRun: false,
    });

    expect(stats).toEqual({
      examined: 2,
      processed: 2,
      skipped: 0,
      failed: 0,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    // The point of the backfill is the acknowledgment history, so assert it reached the transaction
    // rather than trusting the call count.
    const written: Provenance[] = transaction.mock.calls.flatMap(([{ requests }]) =>
      requests
        .filter((request: { resource?: Provenance }) => request.resource?.resourceType === 'Provenance')
        .map((request: { resource: Provenance }) => request.resource)
    );
    expect(
      written.map(
        (provenance) =>
          provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL)?.valueString
      )
    ).toEqual([expect.stringContaining('Acknowledged'), expect.stringContaining('Accepted for processing')]);
    expect(written.every((provenance) => provenance.recorded === '2026-08-06T12:47:00.000Z')).toBe(true);
  });

  it('writes nothing in a dry run but still reports what it would do', async () => {
    const responses = [
      claimResponse('9001', [
        {
          status: 'A',
          responseid: '9001',
          message: 'Acknowledged',
        },
      ]),
    ];
    const { projectClient, billingClient, transaction } = makeClients(responses);

    const stats = await backfillClaimStatusHistory({
      projectClient,
      billingClient,
      secrets: null as never,
      dryRun: true,
    });

    expect(stats).toEqual({
      examined: 1,
      processed: 1,
      skipped: 0,
      failed: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('counts a response with nothing to record as skipped', async () => {
    // Already carries both tags, so the subscription's completion check short-circuits it.
    const processed = claimResponse('9001', [
      {
        status: 'A',
        responseid: '9001',
        message: 'Acknowledged',
      },
    ]);
    processed.meta = {
      versionId: '2',
      tag: [BILLING_RESOURCE_TAG, CLAIM_STATUS_PROCESSED_TAG],
    };
    const { projectClient, billingClient, transaction } = makeClients([processed]);

    const stats = await backfillClaimStatusHistory({
      projectClient,
      billingClient,
      secrets: null as never,
      dryRun: false,
    });

    expect(stats).toEqual({
      examined: 1,
      processed: 0,
      skipped: 1,
      failed: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('keeps going after a failure and reports it', async () => {
    const responses = [
      claimResponse('9001', [
        {
          status: 'A',
          responseid: '9001',
          message: 'Acknowledged',
        },
      ]),
      claimResponse('9002', [
        {
          status: 'A',
          responseid: '9002',
          message: 'Accepted',
        },
      ]),
    ];
    const { projectClient, billingClient, transaction } = makeClients(responses);
    transaction.mockRejectedValueOnce(new Error('FHIR is down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const stats = await backfillClaimStatusHistory({
      projectClient,
      billingClient,
      secrets: null as never,
      dryRun: false,
    });

    expect(stats).toEqual({
      examined: 2,
      processed: 1,
      skipped: 0,
      failed: 1,
    });
  });
});
