import Oystehr from '@oystehr/sdk';
import { Practitioner, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { FHIR_IDENTIFIER_CODE_STATE_LICENSE } from 'utils/lib/fhir/constants';
import { CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE } from 'utils/lib/helpers/rcm/constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { describe, expect, it, vi } from 'vitest';
import { getProviderLicense, LICENSE_TAG } from '../../../src/billing/shared';
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

  it('stores the license type as a tag and type + number + state as an SL identifier', async () => {
    const stateLicenseType = {
      coding: [{ system: CODE_SYSTEM_CLAIM_SECONDARY_IDENTIFIER_TYPE, code: FHIR_IDENTIFIER_CODE_STATE_LICENSE }],
    };
    const existing: Practitioner = {
      ...provider,
      meta: { tag: [{ system: LICENSE_TAG, code: 'NP' }] },
      identifier: [{ type: stateLicenseType, value: 'NPOLD1NY' }],
    };
    const { oystehr, update } = makeOystehr(existing);

    await performEffect(oystehr, {
      kind: 'individual',
      providerId: 'prov-1',
      firstName: 'John',
      lastName: 'Smith',
      roles: ['rendering'],
      license: { type: 'MD', number: 'A12345', state: 'CA' },
      secrets: null,
    });

    const saved = update.mock.calls[0][0] as Practitioner;
    expect(saved.identifier).toEqual([{ type: stateLicenseType, value: 'MDA12345CA' }]);
    expect(saved.meta?.tag?.filter((t) => t.system === LICENSE_TAG)).toEqual([{ system: LICENSE_TAG, code: 'MD' }]);
    expect(getProviderLicense(saved)).toEqual({ type: 'MD', number: 'A12345', state: 'CA' });
  });
});
