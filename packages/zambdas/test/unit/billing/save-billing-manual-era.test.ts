import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Claim, ClaimResponse, FhirResource, Organization, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { MANUAL_ERA_VERSION_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraContext,
} from '../../../src/billing/manual-era';
import { performEffect } from '../../../src/billing/save-billing-manual-era';
import { SaveManualEraParams } from '../../../src/billing/save-billing-manual-era/validateRequestParameters';
import {
  MANUAL_ERA_IDEMPOTENCY_SYSTEM,
  payerDisplay,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_TAG,
  resolvePayersByRef,
} from '../../../src/billing/shared';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolvePayersByRef: vi.fn(),
}));

const PAYER_URL = 'https://rcm-api.zapehr.com/v1/payer/payer-uhc';
const NOW = '2026-09-24T12:00:00.000Z';
const ACTOR = { reference: 'Practitioner/biller-1', display: 'biller@example.com' };

const header: ManualEraHeader = {
  payerId: 'payer-uhc',
  billingProviderRef: 'Organization/org-1',
  checkNumber: '557801',
  checkAmountCents: 10_000,
  remitDate: '2026-09-13',
  checkDate: '2026-09-12',
  depositDate: '2026-09-14',
};

const PAYER_ORG: Organization = { resourceType: 'Organization', id: 'payer-uhc', name: 'United Health Care' };

// what the zambda resolves for the header above
const context: ManualEraContext = {
  payer: { reference: PAYER_URL, display: payerDisplay(PAYER_ORG) ?? '' },
  billingProvider: { reference: 'Organization/org-1', name: 'some org', npi: '8675309123' },
};

const keyedClaim = (overrides: Partial<ManualEraClaim> = {}): ManualEraClaim => ({
  statusCode: '1',
  patientName: 'Joe Schmoe',
  serviceLines: [
    {
      serviceDate: '2026-08-15',
      procedureCode: '99212',
      billedCents: 15_000,
      allowedCents: 10_000,
      paidCents: 5_000,
      adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 5_000 }],
      remarkCodes: [],
    },
  ],
  ...overrides,
});

const billingOrg: Organization = {
  resourceType: 'Organization',
  id: 'org-1',
  name: 'some org',
  identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '8675309123' }],
  meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: PROVIDER_ROLE_BILLING }] },
};

// A stored manual remit: PaymentReconciliation (version 3), one unmatched and one matched claim, and
// the era-processing Provenance linking them.
function storedRemit(): FhirResource[] {
  const pr: PaymentReconciliation = {
    ...buildManualPaymentReconciliation({
      header,
      context,
      created: '2026-09-20T10:00:00.000Z',
      editedAt: '2026-09-20T10:00:00.000Z',
    }),
    id: 'era-1',
    meta: { versionId: '3' },
  };
  const unmatched: ClaimResponse = {
    ...buildManualClaimResponse({ claim: keyedClaim(), header, context }),
    id: 'cr-1',
  };
  const matched: ClaimResponse = {
    ...buildManualClaimResponse({
      claim: keyedClaim({ patientName: 'Ann Lee' }),
      header,
      context,
      matchedClaim: {
        id: 'claim-2',
        patient: { reference: 'Patient/p2' },
        type: { coding: [{ code: 'professional' }] },
      },
    }),
    id: 'cr-2',
  };
  const provenance: Provenance = {
    ...buildManualEraProvenance({
      targets: ['PaymentReconciliation/era-1', 'ClaimResponse/cr-1', 'ClaimResponse/cr-2'],
      agent: { reference: 'Practitioner/first-biller', display: 'first@example.com' },
      recorded: '2026-09-20T10:00:00.000Z',
    }),
    id: 'prov-1',
  };
  return [pr, unmatched, matched, provenance];
}

// In-memory FHIR store: searches by _id / target / identifier, and a transaction that echoes each
// request back with an id and version, the way the server answers.
function makeClient(resources: FhirResource[]): { oystehr: Oystehr; transaction: Mock } {
  const search = vi.fn(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      const param = (name: string): string | undefined => params.find((p) => p.name === name)?.value;
      let results = resources.filter((resource) => resource.resourceType === resourceType);
      const ids = param('_id')?.split(',');
      if (ids) results = results.filter((resource) => ids.includes(resource.id ?? ''));
      const targets = param('target')?.split(',');
      if (targets) {
        results = results.filter(
          (resource) => (resource as Provenance).target?.some((target) => targets.includes(target.reference ?? ''))
        );
      }
      const identifier = param('identifier');
      if (identifier) {
        const [system, value] = identifier.split('|');
        results = results.filter(
          (resource) =>
            (resource as PaymentReconciliation).identifier?.some((id) => id.system === system && id.value === value)
        );
      }
      return { unbundle: () => results, link: [] };
    }
  );
  let created = 0;
  const transaction = vi.fn(async ({ requests }: { requests: BatchInputRequest<FhirResource>[] }) => ({
    entry: requests.map((request) => {
      if (request.method === 'DELETE') return { response: { status: '204' } };
      const resource = (request as { resource: FhirResource }).resource;
      const id = resource.id ?? `${resource.resourceType}-new-${++created}`;
      const versionId = request.method === 'PUT' ? '4' : '1';
      return {
        resource: { ...resource, id, meta: { versionId } },
        response: { location: `${resource.resourceType}/${id}/_history/${versionId}` },
      };
    }),
  }));
  return { oystehr: { fhir: { search, transaction } } as unknown as Oystehr, transaction };
}

const params = (overrides: Partial<SaveManualEraParams>): SaveManualEraParams => ({
  claims: [],
  deleteClaimResponseIds: [],
  secrets: null as unknown as SaveManualEraParams['secrets'],
  userToken: 'token',
  ...overrides,
});

const requestsOf = (transaction: Mock): BatchInputRequest<FhirResource>[] => transaction.mock.calls[0][0].requests;
const describeRequests = (requests: BatchInputRequest<FhirResource>[]): string[] =>
  requests.map((request) => `${request.method} ${request.url}`);

describe('save-billing-manual-era performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (resolvePayersByRef as Mock).mockResolvedValue(new Map([[PAYER_URL, PAYER_ORG]]));
  });

  it('creates the remit and its era-processing record, authored by the caller', async () => {
    const { oystehr, transaction } = makeClient([billingOrg]);
    const result = await performEffect(oystehr, params({ header, idempotencyKey: 'key-1' }), ACTOR, NOW);

    const requests = requestsOf(transaction);
    expect(describeRequests(requests)).toEqual(['POST /PaymentReconciliation', 'POST /Provenance']);
    const prRequest = requests[0] as { fullUrl: string; resource: PaymentReconciliation };
    expect(prRequest.resource.created).toBe(NOW);
    expect(prRequest.resource.identifier).toContainEqual({ system: MANUAL_ERA_IDEMPOTENCY_SYSTEM, value: 'key-1' });
    expect((requests[1] as { resource: Provenance }).resource).toMatchObject({
      target: [{ reference: prRequest.fullUrl }],
      agent: [{ who: ACTOR }],
      recorded: NOW,
    });
    expect(result).toEqual({ eraId: 'PaymentReconciliation-new-1', versionId: '1', claims: [] });
  });

  it('returns the remit a retried create already made', async () => {
    const existing: PaymentReconciliation = {
      ...(storedRemit()[0] as PaymentReconciliation),
      identifier: [{ system: MANUAL_ERA_IDEMPOTENCY_SYSTEM, value: 'key-1' }],
    };
    const { oystehr, transaction } = makeClient([existing]);
    await expect(performEffect(oystehr, params({ header, idempotencyKey: 'key-1' }), ACTOR, NOW)).resolves.toEqual({
      eraId: 'era-1',
      versionId: '3',
      claims: [],
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a save made from a stale copy', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    await expect(
      performEffect(oystehr, params({ eraId: 'era-1', expectedVersionId: '2', header }), ACTOR, NOW)
    ).rejects.toEqual(MANUAL_ERA_VERSION_CONFLICT_ERROR);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('turns a lost optimistic-lock race into the same conflict', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    transaction.mockRejectedValueOnce(new Oystehr.OystehrSdkError({ message: 'precondition failed', code: 412 }));
    await expect(
      performEffect(oystehr, params({ eraId: 'era-1', expectedVersionId: '3', header }), ACTOR, NOW)
    ).rejects.toEqual(MANUAL_ERA_VERSION_CONFLICT_ERROR);
  });

  it('only edits manually entered remits', async () => {
    const [pr, ...rest] = storedRemit();
    const imported = { ...(pr as PaymentReconciliation), extension: [] };
    const { oystehr } = makeClient([imported, ...rest, billingOrg]);
    await expect(
      performEffect(oystehr, params({ eraId: 'era-1', expectedVersionId: '3', header }), ACTOR, NOW)
    ).rejects.toMatchObject({ message: 'Only manually entered remits can be edited' });
  });

  it('adds a claim and replaces the link record, keeping who keyed the remit in', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    const result = await performEffect(
      oystehr,
      params({ eraId: 'era-1', expectedVersionId: '3', claims: [{ ...keyedClaim(), clientKey: 'k1' }] }),
      ACTOR,
      NOW
    );

    const requests = requestsOf(transaction);
    expect(describeRequests(requests)).toEqual([
      'PUT /PaymentReconciliation/era-1',
      'POST /ClaimResponse',
      'DELETE /Provenance/prov-1',
      'POST /Provenance',
    ]);
    // the PaymentReconciliation write carries the version the editor loaded
    expect(requests[0]).toMatchObject({ ifMatch: 'W/"3"' });
    const newClaim = requests[1] as { fullUrl: string; resource: ClaimResponse };
    expect(newClaim.resource.request).toEqual({ reference: '#request' });
    expect((requests[3] as { resource: Provenance }).resource).toMatchObject({
      target: [
        { reference: 'PaymentReconciliation/era-1' },
        { reference: 'ClaimResponse/cr-1' },
        { reference: 'ClaimResponse/cr-2' },
        { reference: newClaim.fullUrl },
      ],
      recorded: '2026-09-20T10:00:00.000Z',
      agent: [{ who: { reference: 'Practitioner/first-biller', display: 'first@example.com' } }],
    });
    expect(result).toEqual({
      eraId: 'era-1',
      versionId: '4',
      claims: [{ clientKey: 'k1', claimResponseId: 'ClaimResponse-new-1' }],
    });
  });

  it('adds a claim associated with an existing Claim as matched', async () => {
    const claim: Claim = {
      resourceType: 'Claim',
      id: 'claim-9',
      status: 'active',
      use: 'claim',
      created: '2026-08-15',
      type: { coding: [{ code: 'professional' }] },
      patient: { reference: 'Patient/p9' },
      provider: { reference: 'Organization/org-1' },
      priority: { coding: [] },
      insurance: [],
    };
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg, claim]);
    await performEffect(
      oystehr,
      params({ eraId: 'era-1', expectedVersionId: '3', claims: [keyedClaim({ matchedClaimId: 'claim-9' })] }),
      ACTOR,
      NOW
    );
    const added = requestsOf(transaction)[1] as { resource: ClaimResponse };
    expect(added.resource).toMatchObject({
      request: { reference: 'Claim/claim-9' },
      patient: { reference: 'Patient/p9' },
      insurer: context.payer,
    });
  });

  it('rejects an associated claim that does not exist', async () => {
    const { oystehr } = makeClient([...storedRemit(), billingOrg]);
    await expect(
      performEffect(
        oystehr,
        params({ eraId: 'era-1', expectedVersionId: '3', claims: [keyedClaim({ matchedClaimId: 'nope' })] }),
        ACTOR,
        NOW
      )
    ).rejects.toMatchObject({ message: 'Claim nope was not found' });
  });

  it('edits a claim in place, keeping its match, without touching the link record', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    const edited = keyedClaim({ claimResponseId: 'cr-2', patientName: 'Ann Lee', memberId: 'M-2' });
    const result = await performEffect(
      oystehr,
      params({ eraId: 'era-1', expectedVersionId: '3', claims: [edited] }),
      ACTOR,
      NOW
    );

    const requests = requestsOf(transaction);
    expect(describeRequests(requests)).toEqual(['PUT /PaymentReconciliation/era-1', 'PUT /ClaimResponse/cr-2']);
    expect((requests[1] as { resource: ClaimResponse }).resource).toMatchObject({
      id: 'cr-2',
      request: { reference: 'Claim/claim-2' },
      patient: { reference: 'Patient/p2' },
    });
    expect(result.claims).toEqual([{ claimResponseId: 'cr-2' }]);
  });

  it('skips claims a header save leaves unchanged, and rebuilds them when it changes what they copy', async () => {
    const unchanged = makeClient([...storedRemit(), billingOrg]);
    await performEffect(unchanged.oystehr, params({ eraId: 'era-1', expectedVersionId: '3', header }), ACTOR, NOW);
    expect(describeRequests(requestsOf(unchanged.transaction))).toEqual(['PUT /PaymentReconciliation/era-1']);

    const changed = makeClient([...storedRemit(), billingOrg]);
    await performEffect(
      changed.oystehr,
      params({ eraId: 'era-1', expectedVersionId: '3', header: { ...header, remitDate: '2026-09-15' } }),
      ACTOR,
      NOW
    );
    const requests = requestsOf(changed.transaction);
    expect(describeRequests(requests)).toEqual([
      'PUT /PaymentReconciliation/era-1',
      'PUT /ClaimResponse/cr-1',
      'PUT /ClaimResponse/cr-2',
    ]);
    expect((requests[1] as { resource: ClaimResponse }).resource.created).toBe('2026-09-15');
    // the matched claim stays matched through the rebuild
    expect((requests[2] as { resource: ClaimResponse }).resource.request).toEqual({ reference: 'Claim/claim-2' });
  });

  it('removes an unmatched claim and drops it from the link record', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    await performEffect(
      oystehr,
      params({ eraId: 'era-1', expectedVersionId: '3', deleteClaimResponseIds: ['cr-1'] }),
      ACTOR,
      NOW
    );
    const requests = requestsOf(transaction);
    expect(describeRequests(requests)).toEqual([
      'PUT /PaymentReconciliation/era-1',
      'DELETE /Provenance/prov-1',
      'DELETE /ClaimResponse/cr-1',
      'POST /Provenance',
    ]);
    expect((requests[3] as { resource: Provenance }).resource.target).toEqual([
      { reference: 'PaymentReconciliation/era-1' },
      { reference: 'ClaimResponse/cr-2' },
    ]);
  });

  it('will not remove a matched claim', async () => {
    const { oystehr, transaction } = makeClient([...storedRemit(), billingOrg]);
    await expect(
      performEffect(
        oystehr,
        params({ eraId: 'era-1', expectedVersionId: '3', deleteClaimResponseIds: ['cr-2'] }),
        ACTOR,
        NOW
      )
    ).rejects.toMatchObject({ message: 'Unmatch this claim before removing it from the remit' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses claims that belong to another remit', async () => {
    const { oystehr } = makeClient([...storedRemit(), billingOrg]);
    await expect(
      performEffect(
        oystehr,
        params({ eraId: 'era-1', expectedVersionId: '3', claims: [keyedClaim({ claimResponseId: 'cr-elsewhere' })] }),
        ACTOR,
        NOW
      )
    ).rejects.toMatchObject({ message: 'Claim cr-elsewhere is not part of this remit' });
    await expect(
      performEffect(
        oystehr,
        params({ eraId: 'era-1', expectedVersionId: '3', deleteClaimResponseIds: ['cr-x'] }),
        ACTOR,
        NOW
      )
    ).rejects.toMatchObject({ message: 'Claim cr-x is not part of this remit' });
  });

  it('requires a billing provider and a known payer', async () => {
    const renderingOnly: Organization = {
      ...billingOrg,
      meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: 'rendering' }] },
    };
    await expect(
      performEffect(makeClient([renderingOnly]).oystehr, params({ header, idempotencyKey: 'k' }), ACTOR, NOW)
    ).rejects.toMatchObject({ message: 'The billing provider was not found' });

    (resolvePayersByRef as Mock).mockResolvedValue(new Map());
    await expect(
      performEffect(makeClient([billingOrg]).oystehr, params({ header, idempotencyKey: 'k' }), ACTOR, NOW)
    ).rejects.toMatchObject({ message: 'Payer payer-uhc was not found' });
  });
});
