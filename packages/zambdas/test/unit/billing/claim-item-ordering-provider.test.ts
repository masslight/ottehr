import Oystehr from '@oystehr/sdk';
import { Bundle, Claim, FhirResource, Practitioner } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  assertOrderingProvidersExist,
  EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER,
  readClaimItemOrderingProvider,
  setClaimItemOrderingProviders,
} from '../../../src/billing/shared';

const claimWithItems = (count: number, extra?: Partial<Claim>): Claim =>
  ({
    resourceType: 'Claim',
    id: 'claim-1',
    item: Array.from({ length: count }, (_, i) => ({
      sequence: i + 1,
      productOrService: { coding: [{ code: '99213' }] },
    })),
    ...extra,
  }) as Claim;

const orderingExtension = (claim: Claim, index: number): unknown =>
  claim.item?.[index]?.extension?.find((ext) => ext.url === EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER);

const existingPractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ family: 'House', given: ['Gregory'] }],
  identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
};

// The shape getResourcesFromBatchInlineRequests parses: a batch-response of searchset bundles.
const batchResponse = (resources: FhirResource[]): Bundle => ({
  resourceType: 'Bundle',
  type: 'batch-response',
  entry: [
    {
      response: { status: '200', outcome: { resourceType: 'OperationOutcome', id: 'ok', issue: [] } },
      resource: { resourceType: 'Bundle', type: 'searchset', entry: resources.map((resource) => ({ resource })) },
    },
  ],
});

const house = { firstName: 'Gregory', lastName: 'House' };
const outside = { firstName: 'Jane', lastName: 'Outside' };

describe('setClaimItemOrderingProviders', () => {
  it('references an existing Practitioner by id', () => {
    const claim = claimWithItems(1);
    setClaimItemOrderingProviders(claim, [{ ...house, providerId: 'prac-1' }]);

    expect(orderingExtension(claim, 0)).toEqual({
      url: EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER,
      valueReference: { reference: 'Practitioner/prac-1', display: 'House, Gregory' },
    });
    expect(claim.contained).toBeUndefined();
  });

  it('stores a manually entered provider as a contained Practitioner, shared by identical entries', () => {
    const claim = claimWithItems(3);
    const manual = { ...outside, npi: '1234567893' };
    setClaimItemOrderingProviders(claim, [manual, { ...manual }, { firstName: 'John', lastName: 'Other' }]);

    expect(claim.contained).toHaveLength(2);
    const [first, second] = claim.contained as Practitioner[];
    expect(first).toMatchObject({ resourceType: 'Practitioner', name: [{ family: 'Outside', given: ['Jane'] }] });
    expect(first.identifier?.some((id) => id.system === FHIR_IDENTIFIER_NPI && id.value === '1234567893')).toBe(true);
    expect(second).toMatchObject({ resourceType: 'Practitioner', name: [{ family: 'Other', given: ['John'] }] });

    const refs = [0, 1, 2].map(
      (i) => (orderingExtension(claim, i) as { valueReference: { reference: string; display: string } }).valueReference
    );
    expect(refs).toEqual([
      { reference: `#${first.id}`, display: 'Outside, Jane' },
      { reference: `#${first.id}`, display: 'Outside, Jane' },
      { reference: `#${second.id}`, display: 'Other, John' },
    ]);
  });

  it('leaves items without an ordering provider untouched', () => {
    const claim = claimWithItems(2);
    setClaimItemOrderingProviders(claim, [undefined, outside]);
    expect(claim.item?.[0]?.extension).toBeUndefined();
    expect(orderingExtension(claim, 1)).toBeDefined();
  });

  it('replaces previously contained ordering providers and keeps other contained resources', () => {
    const claim = claimWithItems(1);
    setClaimItemOrderingProviders(claim, [{ firstName: 'Old', lastName: 'Doc' }]);
    claim.contained = [...(claim.contained ?? []), { resourceType: 'Organization', id: 'something-else' }];

    setClaimItemOrderingProviders(claim, [undefined]);

    expect(claim.contained).toEqual([{ resourceType: 'Organization', id: 'something-else' }]);
    expect(claim.item?.[0]?.extension).toBeUndefined();
  });
});

describe('readClaimItemOrderingProvider', () => {
  it('round-trips a manually entered provider through the claim contained resources', () => {
    const claim = claimWithItems(1);
    const manual = { ...outside, npi: '1234567893' };
    setClaimItemOrderingProviders(claim, [manual]);

    expect(readClaimItemOrderingProvider(claim, claim.item![0], [])).toEqual(manual);
  });

  it('resolves an existing Practitioner from the fetched practitioners', () => {
    const claim = claimWithItems(1);
    setClaimItemOrderingProviders(claim, [{ firstName: 'stale', lastName: 'name', providerId: 'prac-1' }]);

    expect(readClaimItemOrderingProvider(claim, claim.item![0], [existingPractitioner])).toEqual({
      ...house,
      npi: '1234567893',
      providerId: 'prac-1',
    });
  });

  it('ignores a reference to anything but a Practitioner', () => {
    const claim = claimWithItems(1);
    claim.item![0].extension = [
      { url: EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER, valueReference: { reference: 'Organization/org-1' } },
    ];
    expect(readClaimItemOrderingProvider(claim, claim.item![0], [existingPractitioner])).toBeUndefined();
  });

  it('returns undefined when the provider cannot be resolved', () => {
    const claim = claimWithItems(1);
    setClaimItemOrderingProviders(claim, [{ ...house, providerId: 'gone' }]);
    expect(readClaimItemOrderingProvider(claim, claim.item![0], [])).toBeUndefined();
  });

  it('returns undefined for an item without the extension', () => {
    const claim = claimWithItems(1);
    expect(readClaimItemOrderingProvider(claim, claim.item![0], [])).toBeUndefined();
  });
});

describe('assertOrderingProvidersExist', () => {
  const oystehrWith = (found: FhirResource[]): { oystehr: Oystehr; batch: ReturnType<typeof vi.fn> } => {
    const batch = vi.fn().mockResolvedValue(batchResponse(found));
    return { oystehr: { fhir: { batch } } as unknown as Oystehr, batch };
  };

  it('looks the referenced ids up as Practitioners in one request', async () => {
    const { oystehr, batch } = oystehrWith([existingPractitioner]);
    await expect(
      assertOrderingProvidersExist(oystehr, [
        { ...house, providerId: 'prac-1' },
        { ...house, providerId: 'prac-1' },
        outside,
        undefined,
      ])
    ).resolves.toBeUndefined();
    expect(batch).toHaveBeenCalledWith({ requests: [{ method: 'GET', url: '/Practitioner?_id=prac-1' }] });
  });

  it('rejects an id that is not an existing Practitioner', async () => {
    const { oystehr } = oystehrWith([existingPractitioner]);
    await expect(
      assertOrderingProvidersExist(oystehr, [
        { ...house, providerId: 'prac-1' },
        { firstName: 'Princeton', lastName: 'Plainsboro', providerId: 'org-1' },
      ])
    ).rejects.toMatchObject({ message: expect.stringContaining('org-1') });
  });

  it('skips the lookup when no line references an existing Practitioner', async () => {
    const { oystehr, batch } = oystehrWith([]);
    await assertOrderingProvidersExist(oystehr, [outside, undefined]);
    expect(batch).not.toHaveBeenCalled();
  });
});
