import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import { ClinicalNioOption } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateVisitEmployerSelection } from '../../src/ehr/visit-details/update-visit-details';

const NIO_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_ORG_ID = '22222222-2222-4222-8222-222222222222';

// FEATURE_FLAGS_CONFIG is a frozen compile-time constant; tests toggle it by mocking the module
// with a mutable object.
const flags = vi.hoisted(() => ({ nonInsuranceOrganizationsEnabled: true }));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: flags }));

const nioOption: ClinicalNioOption = {
  id: NIO_ID,
  reference: getNioReferenceUrl(NIO_ID),
  name: 'FedEx',
  employer: true,
  active: true,
  coversCategories: ['workers-comp'],
};

const legacyEmployerOrg: Organization = {
  resourceType: 'Organization',
  id: LEGACY_ORG_ID,
  active: true,
  name: 'Acme Industrial Corp',
  type: [
    {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'occupational-medicine-employer' },
      ],
    },
  ],
};

function makeOystehr(options: { directoryOptions?: ClinicalNioOption[]; legacyOrg?: Organization }): {
  oystehr: Oystehr;
  execute: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn().mockResolvedValue({ output: { organizations: options.directoryOptions ?? [] } });
  const get = vi.fn().mockResolvedValue(options.legacyOrg);
  const oystehr = { zambda: { execute }, fhir: { get } } as unknown as Oystehr;
  return { oystehr, execute, get };
}

describe('validateVisitEmployerSelection', () => {
  beforeEach(() => {
    flags.nonInsuranceOrganizationsEnabled = true;
  });

  describe('NIO mode (flag on)', () => {
    it('accepts an active employer NIO token, resolved over the wire — never via FHIR', async () => {
      const { oystehr, execute, get } = makeOystehr({ directoryOptions: [nioOption] });

      await expect(
        validateVisitEmployerSelection(oystehr, { reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' })
      ).resolves.toBeUndefined();

      expect(execute).toHaveBeenCalledWith({ id: 'list-non-insurance-organizations', nioId: NIO_ID });
      expect(get).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown NIO', [], 'existing'],
      ['a deleted NIO', [{ ...nioOption, active: false }], 'active'],
      ['a non-employer NIO', [{ ...nioOption, employer: false }], 'employer'],
    ])('rejects %s', async (_label, directoryOptions, expectedWord) => {
      const { oystehr } = makeOystehr({ directoryOptions });
      await expect(
        validateVisitEmployerSelection(oystehr, { reference: getNioReferenceUrl(NIO_ID) })
      ).rejects.toMatchObject({ message: expect.stringContaining(expectedWord) });
    });

    it('rejects a legacy Organization reference — legacy employers are never selectable again', async () => {
      const { oystehr, get } = makeOystehr({ legacyOrg: legacyEmployerOrg });
      await expect(
        validateVisitEmployerSelection(oystehr, { reference: `Organization/${LEGACY_ORG_ID}` })
      ).rejects.toMatchObject({ message: expect.stringContaining('non-insurance organization') });
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('legacy mode (flag off)', () => {
    beforeEach(() => {
      flags.nonInsuranceOrganizationsEnabled = false;
    });

    it('accepts an active occ-med employer organization via FHIR', async () => {
      const { oystehr, get, execute } = makeOystehr({ legacyOrg: legacyEmployerOrg });

      await expect(
        validateVisitEmployerSelection(oystehr, { reference: `Organization/${LEGACY_ORG_ID}` })
      ).resolves.toBeUndefined();

      expect(get).toHaveBeenCalledWith({ resourceType: 'Organization', id: LEGACY_ORG_ID });
      expect(execute).not.toHaveBeenCalled();
    });

    it('rejects an inactive legacy organization', async () => {
      const { oystehr } = makeOystehr({ legacyOrg: { ...legacyEmployerOrg, active: false } });
      await expect(
        validateVisitEmployerSelection(oystehr, { reference: `Organization/${LEGACY_ORG_ID}` })
      ).rejects.toMatchObject({ message: expect.stringContaining('active') });
    });

    it('rejects a non-employer legacy organization', async () => {
      const { oystehr } = makeOystehr({
        legacyOrg: { ...legacyEmployerOrg, type: [{ coding: [{ code: 'other' }] }] },
      });
      await expect(
        validateVisitEmployerSelection(oystehr, { reference: `Organization/${LEGACY_ORG_ID}` })
      ).rejects.toMatchObject({ message: expect.stringContaining('occupational medicine employer') });
    });

    it('rejects an NIO token when the deployment is not in NIO mode', async () => {
      const { oystehr, execute } = makeOystehr({});
      await expect(
        validateVisitEmployerSelection(oystehr, { reference: getNioReferenceUrl(NIO_ID) })
      ).rejects.toMatchObject({ message: expect.stringContaining('this deployment') });
      expect(execute).not.toHaveBeenCalled();
    });
  });
});
