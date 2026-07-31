import Oystehr from '@oystehr/sdk';
import { Patient, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/update-billing-patient';

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  meta: { versionId: '2' },
  name: [{ given: ['Jane'], family: 'Doe' }],
  telecom: [{ system: 'phone', value: '555-0100' }],
};

function makeOystehr(): { oystehr: Oystehr; update: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> } {
  const search = vi.fn().mockResolvedValue({ unbundle: () => [structuredClone(patient)] });
  const update = vi.fn().mockImplementation((resource: Patient) => Promise.resolve(resource));
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const oystehr = { fhir: { search, update, transaction } } as unknown as Oystehr;
  return { oystehr, update, transaction };
}

const parseChanges = (provenance: Provenance): ClaimFieldChange[] =>
  JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

describe('update-billing-patient', () => {
  it('writes the update and its claim-history Provenance in one transaction when claim-scoped', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { patientId: 'pat-1', claimId: CLAIM_ID, firstName: 'Jane', lastName: 'Smith', phone: '555-0199', secrets: null },
      agent
    );

    expect(result).toEqual({ id: 'pat-1' });
    expect(update).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string }) => r.method)).toEqual(['PUT', 'POST']);
    expect(requests[0].url).toBe('Patient/pat-1');
    const provenance = requests[1].resource as Provenance;
    expect(provenance.target).toEqual([{ reference: 'Patient/pat-1' }, { reference: `Claim/${CLAIM_ID}` }]);
    expect(provenance.agent?.[0]).toEqual(agent);
    // The prior version rides along for the history feature.
    expect(provenance.entity?.[0]?.what?.reference).toBe('Patient/pat-1/_history/2');
    const changes = parseChanges(provenance);
    expect(changes).toContainEqual({
      field: 'name',
      label: 'Name',
      previousValue: 'Doe, Jane',
      newValue: 'Smith, Jane',
    });
    expect(changes).toContainEqual({ field: 'phone', label: 'Phone', previousValue: '555-0100', newValue: '555-0199' });
  });

  it('keeps the plain update (no Provenance) when no claimId is given', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { patientId: 'pat-1', firstName: 'Jane', lastName: 'Smith', secrets: null },
      undefined
    );

    expect(result).toEqual({ id: 'pat-1' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });
});
