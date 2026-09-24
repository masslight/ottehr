import Oystehr from '@oystehr/sdk';
import { Practitioner, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { getBillingProviderLicenses } from 'utils/lib/fhir/billing';
import { PRACTITIONER_QUALIFICATION_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { makeQualificationForPractitioner } from 'utils/lib/fhir/practitioners';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/update-billing-provider';

const CLAIM_ID = '22222222-2222-4222-8222-222222222222';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const provider: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prov-1',
  meta: { versionId: '3' },
  name: [{ given: ['John'], family: 'Smith' }],
};

function makeOystehr(existing: Practitioner = provider): {
  oystehr: Oystehr;
  update: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({ unbundle: () => [structuredClone(existing)] });
  const update = vi.fn().mockImplementation((resource: Practitioner) => Promise.resolve(resource));
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const oystehr = { fhir: { search, update, transaction } } as unknown as Oystehr;
  return { oystehr, update, transaction };
}

const parseChanges = (provenance: Provenance): ClaimFieldChange[] =>
  JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

describe('update-billing-provider', () => {
  it('writes the update and its claim-history Provenance in one transaction when claim-scoped', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      {
        kind: 'individual',
        providerId: 'prov-1',
        claimId: CLAIM_ID,
        firstName: 'John',
        lastName: 'Jones',
        roles: ['rendering'],
        npi: '1234567893',
        secrets: null,
      },
      agent
    );

    expect(result).toEqual({ id: 'prov-1' });
    expect(update).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string }) => r.method)).toEqual(['PUT', 'POST']);
    expect(requests[0].url).toBe('Practitioner/prov-1');
    const provenance = requests[1].resource as Provenance;
    expect(provenance.target).toEqual([{ reference: 'Practitioner/prov-1' }, { reference: `Claim/${CLAIM_ID}` }]);
    expect(provenance.agent?.[0]).toEqual(agent);
    const changes = parseChanges(provenance);
    expect(changes).toContainEqual({
      field: 'name',
      label: 'Name',
      previousValue: 'Smith, John',
      newValue: 'Jones, John',
    });
    expect(changes).toContainEqual({ field: 'npi', label: 'NPI', previousValue: null, newValue: '1234567893' });
  });

  it('keeps the plain update (no Provenance) when no claimId is given', async () => {
    const { oystehr, update, transaction } = makeOystehr();

    const result = await performEffect(
      oystehr,
      {
        kind: 'individual',
        providerId: 'prov-1',
        firstName: 'John',
        lastName: 'Jones',
        roles: ['rendering'],
        secrets: null,
      },
      undefined
    );

    expect(result).toEqual({ id: 'prov-1' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('replaces licenses and drops the legacy license-type tag, keeping expiry of retained licenses', async () => {
    const existing: Practitioner = {
      ...provider,
      meta: { tag: [{ system: 'https://fhir.ottehr.com/billing/license-type', code: 'MD' }] },
      qualification: [
        { code: { text: 'Board certification' } },
        makeQualificationForPractitioner({ code: 'MD', state: 'CA', number: 'OLD', date: '2030-01-01', active: true }),
        makeQualificationForPractitioner({ code: 'MD', state: 'NY', number: 'NY1', active: true }),
      ],
    };
    const { oystehr, update } = makeOystehr(existing);

    await performEffect(oystehr, {
      kind: 'individual',
      providerId: 'prov-1',
      firstName: 'John',
      lastName: 'Smith',
      roles: ['rendering'],
      licenses: [
        { type: 'MD', number: 'NEW', state: 'CA' },
        { type: 'NP', number: 'TX1', state: 'TX' },
      ],
      secrets: null,
    });

    const saved = update.mock.calls[0][0] as Practitioner;
    expect(getBillingProviderLicenses(saved)).toEqual([
      { type: 'MD', number: 'NEW', state: 'CA' },
      { type: 'NP', number: 'TX1', state: 'TX' },
    ]);
    expect(saved.qualification?.[0]).toEqual({ code: { text: 'Board certification' } });
    const caExtensions = saved.qualification?.[1].extension?.find(
      (e) => e.url === PRACTITIONER_QUALIFICATION_EXTENSION_URL
    )?.extension;
    expect(caExtensions?.find((e) => e.url === 'expDate')?.valueDate).toBe('2030-01-01');
    expect(saved.meta?.tag?.some((t) => t.system === 'https://fhir.ottehr.com/billing/license-type')).toBe(false);
  });
});
