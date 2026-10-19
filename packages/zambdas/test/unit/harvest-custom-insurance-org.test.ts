import Oystehr from '@oystehr/sdk';
import { getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import { CUSTOM_INSURANCE_ORG_ID_SYSTEM } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { describe, expect, it, vi } from 'vitest';
import { searchInsuranceInformation } from '../../src/ehr/shared/harvest';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function makeOystehr(execute: ReturnType<typeof vi.fn>): Oystehr {
  return {
    rcm: { constructPayerUrl: ({ id }: { id: string }) => `https://rcm-api.zapehr.com/v1/payer/${id}` },
    zambda: { execute },
  } as unknown as Oystehr;
}

describe('searchInsuranceInformation — custom insurance organizations', () => {
  it('resolves a custom insurance org reference token through the billing zambda door, not a direct FHIR read', async () => {
    const execute = vi.fn().mockResolvedValue({
      output: {
        organizations: [
          {
            id: ORG_ID,
            reference: getCustomInsuranceOrgReferenceUrl(ORG_ID),
            orgId: 'OTR-ACME',
            name: 'Acme Insurance',
            active: true,
          },
        ],
      },
    });
    const oystehr = makeOystehr(execute);

    const [org] = await searchInsuranceInformation(oystehr, [getCustomInsuranceOrgReferenceUrl(ORG_ID)]);

    expect(execute).toHaveBeenCalledWith({ id: 'list-custom-insurance-organizations', insuranceOrgId: ORG_ID });
    expect(org).toEqual({
      resourceType: 'Organization',
      id: ORG_ID,
      name: 'Acme Insurance',
      active: true,
      identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }],
      // The "pay" organization-type coding every payer org carries — without it, a resolved custom
      // org would be filtered out of any downstream selection of payer-type Organizations (e.g.
      // getCoverageUpdateResourcesFromUnbundled's insuranceOrgs filter).
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'pay' }] }],
    });
  });

  it('throws when the reference token names a custom insurance org that no longer resolves', async () => {
    const execute = vi.fn().mockResolvedValue({ output: { organizations: [] } });
    const oystehr = makeOystehr(execute);

    await expect(searchInsuranceInformation(oystehr, [getCustomInsuranceOrgReferenceUrl(ORG_ID)])).rejects.toThrow(
      /No custom insurance organization matches reference/
    );
  });
});
