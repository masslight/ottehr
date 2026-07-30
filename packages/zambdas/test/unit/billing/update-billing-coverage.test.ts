import Oystehr from '@oystehr/sdk';
import { Coverage, Provenance, ProvenanceAgent, RelatedPerson } from 'fhir/r4b';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/update-billing-coverage';

const CLAIM_ID = '44444444-4444-4444-8444-444444444444';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  meta: { versionId: '5' },
  subscriberId: 'OLD-123',
  subscriber: { reference: 'Patient/pat-1' },
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/9', display: 'Acme Health' }],
};

function makeOystehr(resourcesById: Record<string, unknown> = {}): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockImplementation(({ params }: { params: { name: string; value: string }[] }) => {
    const id = params.find((p) => p.name === '_id')?.value ?? '';
    const resource = resourcesById[id];
    return Promise.resolve({ unbundle: () => (resource ? [resource] : []) });
  });
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const oystehr = { fhir: { search, transaction } } as unknown as Oystehr;
  return { oystehr, transaction };
}

const parseChanges = (provenance: Provenance): ClaimFieldChange[] =>
  JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

describe('update-billing-coverage', () => {
  it('writes the update and its claim-history Provenance in one transaction when claim-scoped', async () => {
    const { oystehr, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      { coverageId: 'cov-1', claimId: CLAIM_ID, memberId: 'NEW-456', secrets: null },
      { patientId: 'pat-1', coverage: structuredClone(coverage) },
      agent
    );

    expect(result).toEqual({ id: 'cov-1' });
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string }) => r.method)).toEqual(['PUT', 'POST']);
    expect(requests[0].url).toBe('Coverage/cov-1');
    const provenance = requests[1].resource as Provenance;
    expect(provenance.target).toEqual([{ reference: 'Coverage/cov-1' }, { reference: `Claim/${CLAIM_ID}` }]);
    expect(provenance.agent?.[0]).toEqual(agent);
    expect(parseChanges(provenance)).toContainEqual({
      field: 'memberId',
      label: 'Member ID',
      previousValue: 'OLD-123',
      newValue: 'NEW-456',
    });
  });

  it('folds policy-holder edits into the coverage record as policyHolder.* changes', async () => {
    const { oystehr, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      {
        coverageId: 'cov-1',
        claimId: CLAIM_ID,
        relationship: 'Spouse',
        policyHolder: { firstName: 'Pat', lastName: 'Holder', dob: '1980-01-01', gender: 'female' },
        secrets: null,
      },
      { patientId: 'pat-1', coverage: structuredClone(coverage) },
      agent
    );

    const requests = transaction.mock.calls[0][0].requests;
    // The new subscriber is created in the same transaction, before the coverage PUT.
    expect(requests.map((r: { method: string; url: string }) => `${r.method} ${r.url}`)).toEqual([
      'POST /RelatedPerson',
      'PUT Coverage/cov-1',
      'POST /Provenance',
    ]);
    const changes = parseChanges(requests[2].resource as Provenance);
    expect(changes).toContainEqual(
      expect.objectContaining({ field: 'relationship', label: 'Relationship', newValue: 'Spouse' })
    );
    expect(changes).toContainEqual({
      field: 'policyHolder.name',
      label: 'Policy Holder Name',
      previousValue: null,
      newValue: 'Holder, Pat',
    });
    expect(changes).toContainEqual({
      field: 'policyHolder.dob',
      label: 'Policy Holder Date of Birth',
      previousValue: null,
      newValue: '1980-01-01',
    });
  });

  it('diffs the policy holder against the current subscriber when one exists', async () => {
    const currentSubscriber: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: 'rp-1',
      patient: { reference: 'Patient/pat-1' },
      name: [{ given: ['Old'], family: 'Holder' }],
      birthDate: '1975-05-05',
    };
    const withSubscriber: Coverage = {
      ...structuredClone(coverage),
      subscriber: { reference: 'RelatedPerson/rp-1' },
    };
    const { oystehr, transaction } = makeOystehr({ 'rp-1': currentSubscriber });

    await performEffect(
      oystehr,
      {
        coverageId: 'cov-1',
        claimId: CLAIM_ID,
        relationship: 'Spouse',
        policyHolder: { firstName: 'Pat', lastName: 'Holder', dob: '1980-01-01', gender: 'female' },
        secrets: null,
      },
      { patientId: 'pat-1', coverage: withSubscriber },
      agent
    );

    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string; url: string }) => `${r.method} ${r.url}`)).toEqual([
      'PUT RelatedPerson/rp-1',
      'PUT Coverage/cov-1',
      'POST /Provenance',
    ]);
    const changes = parseChanges(requests[2].resource as Provenance);
    expect(changes).toContainEqual({
      field: 'policyHolder.name',
      label: 'Policy Holder Name',
      previousValue: 'Holder, Old',
      newValue: 'Holder, Pat',
    });
    expect(changes).toContainEqual({
      field: 'policyHolder.dob',
      label: 'Policy Holder Date of Birth',
      previousValue: '1975-05-05',
      newValue: '1980-01-01',
    });
  });

  it('keeps the plain transaction (no Provenance) when no claimId is given', async () => {
    const { oystehr, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      { coverageId: 'cov-1', memberId: 'NEW-456', secrets: null },
      { patientId: 'pat-1', coverage: structuredClone(coverage) },
      undefined
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string; url: string }) => `${r.method} ${r.url}`)).toEqual([
      'PUT Coverage/cov-1',
    ]);
  });
});
