import Oystehr from '@oystehr/sdk';
import { Location, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { SaveServiceFacilityInput } from 'utils/lib/types/data/billing/billing.schemas';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it, vi } from 'vitest';
import { complexValidation, performEffect } from '../../../src/billing/save-billing-service-facility';

const CLAIM_ID = '33333333-3333-4333-8333-333333333333';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const facility: Location = {
  resourceType: 'Location',
  id: 'fac-1',
  status: 'active',
  meta: { versionId: '4' },
  name: 'Main Lab',
  address: { line: ['1 Main St'], city: 'Springfield', state: 'CA', postalCode: '90210' },
};

const baseInput: SaveServiceFacilityInput = {
  facilityId: 'fac-1',
  name: 'Main Lab',
  addressLine1: '1 Main St',
  city: 'Springfield',
  state: 'CA',
  zip: '90210',
};

const SHARED_NPI = '1234567893';

const sharedNpiFacility: Location = {
  ...facility,
  id: 'fac-2',
  identifier: [
    {
      system: FHIR_IDENTIFIER_NPI,
      value: SHARED_NPI,
    },
  ],
};

function makeOystehr(): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({ unbundle: () => [structuredClone(facility)] });
  const update = vi.fn().mockImplementation((resource: Location) => Promise.resolve(resource));
  const create = vi.fn().mockImplementation((resource: Location) => Promise.resolve({ ...resource, id: 'fac-new' }));
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const oystehr = { fhir: { search, update, create, transaction } } as unknown as Oystehr;
  return {
    oystehr,
    search,
    update,
    create,
    transaction,
  };
}

const parseChanges = (provenance: Provenance): ClaimFieldChange[] =>
  JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

describe('save-billing-service-facility', () => {
  it('writes the update and its claim-history Provenance in one transaction when claim-scoped', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { ...baseInput, claimId: CLAIM_ID, name: 'North Lab', clia: '05D1234567', secrets: null },
      structuredClone(facility),
      agent
    );

    expect(result).toEqual({ id: 'fac-1' });
    expect(update).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string }) => r.method)).toEqual(['PUT', 'POST']);
    expect(requests[0].url).toBe('Location/fac-1');
    // The optimistic lock the plain update used is preserved.
    expect(requests[0].ifMatch).toBe('W/"4"');
    const provenance = requests[1].resource as Provenance;
    expect(provenance.target).toEqual([{ reference: 'Location/fac-1' }, { reference: `Claim/${CLAIM_ID}` }]);
    expect(provenance.agent?.[0]).toEqual(agent);
    const changes = parseChanges(provenance);
    expect(changes).toContainEqual({ field: 'name', label: 'Name', previousValue: 'Main Lab', newValue: 'North Lab' });
    expect(changes).toContainEqual({ field: 'clia', label: 'CLIA', previousValue: null, newValue: '05D1234567' });
  });

  it('keeps the plain locked update (no Provenance) when no claimId is given', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { ...baseInput, name: 'North Lab', secrets: null },
      structuredClone(facility)
    );

    expect(result).toEqual({ id: 'fac-1' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: '4' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('never claim-scopes a create — the subsequent claim attach records the change', async () => {
    const { oystehr, create, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { ...baseInput, facilityId: undefined, claimId: CLAIM_ID, secrets: null },
      undefined,
      agent
    );

    expect(result).toEqual({ id: 'fac-new' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  describe('complexValidation', () => {
    it('allows creating a facility with an NPI another active facility already has', async () => {
      const { oystehr, search } = makeOystehr();
      search.mockResolvedValue({
        unbundle: () => [sharedNpiFacility],
      });

      const result = await complexValidation(
        oystehr,
        {
          ...baseInput,
          facilityId: undefined,
          npi: SHARED_NPI,
          secrets: null,
        },
        undefined
      );

      expect(result).toEqual({
        existing: undefined,
        agent: undefined,
      });
      expect(search).not.toHaveBeenCalled();
    });

    it('allows updating a facility to an NPI another active facility already has', async () => {
      const { oystehr, search } = makeOystehr();
      search
        .mockResolvedValueOnce({
          unbundle: () => [structuredClone(facility)],
        })
        .mockResolvedValue({
          unbundle: () => [sharedNpiFacility],
        });

      const result = await complexValidation(
        oystehr,
        {
          ...baseInput,
          npi: SHARED_NPI,
          secrets: null,
        },
        undefined
      );

      expect(result).toEqual({
        existing: facility,
        agent: undefined,
      });
      expect(search).toHaveBeenCalledTimes(1);
      expect(search.mock.calls[0][0].params).toEqual([
        {
          name: '_id',
          value: 'fac-1',
        },
      ]);
    });
  });
});
