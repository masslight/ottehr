import Oystehr from '@oystehr/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllInsurancePayers } from '../../src/patient/get-all-insurance-payers';

const flags = vi.hoisted(() => ({ customOrganizationsEnabled: true }));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: flags }));

const CUSTOM_ORG_REFERENCE =
  'https://fhir.ottehr.com/billing/custom-insurance-organization/11111111-1111-4111-8111-111111111111';

function makeOystehr(): { oystehr: Oystehr; listPayers: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> } {
  const listPayers = vi.fn().mockResolvedValue({
    data: [
      {
        resourceType: 'Organization',
        name: 'Aetna',
        identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: '60054' }],
      },
    ],
    metadata: { nextCursor: null },
  });
  const execute = vi.fn().mockResolvedValue({
    output: {
      organizations: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          reference: CUSTOM_ORG_REFERENCE,
          orgId: 'OTR-ACME',
          name: 'Acme Insurance',
          active: true,
        },
      ],
    },
  });
  const oystehr = {
    rcm: {
      listPayers,
      constructPayerUrl: ({ id }: { id: string }) => `https://rcm-api.zapehr.com/v1/payer/${id}`,
    },
    zambda: { execute },
  } as unknown as Oystehr;
  return { oystehr, listPayers, execute };
}

describe('getAllInsurancePayers', () => {
  beforeEach(() => {
    flags.customOrganizationsEnabled = true;
  });

  it('lists custom insurance organizations alongside RCM payers when the flag is on', async () => {
    const { oystehr, execute } = makeOystehr();

    const options = await getAllInsurancePayers(oystehr);

    expect(execute).toHaveBeenCalledWith({ id: 'list-custom-insurance-organizations' });
    expect(options).toContainEqual({
      valueReference: { reference: CUSTOM_ORG_REFERENCE, display: 'Acme Insurance' },
    });
    // Still includes the real RCM payer and the "Other" fallback.
    expect(options.some((o) => o.valueReference?.display === 'Aetna')).toBe(true);
    expect(options.some((o) => o.valueReference?.display === 'Other')).toBe(true);
  });

  it('prepends the business id to the display name when prependIdentifier is set', async () => {
    const { oystehr } = makeOystehr();

    const options = await getAllInsurancePayers(oystehr, true);

    expect(options).toContainEqual({
      valueReference: { reference: CUSTOM_ORG_REFERENCE, display: 'OTR-ACME - Acme Insurance' },
    });
  });

  it('does not offer custom insurance organizations when the flag is off', async () => {
    flags.customOrganizationsEnabled = false;
    const { oystehr, execute } = makeOystehr();

    const options = await getAllInsurancePayers(oystehr);

    expect(execute).not.toHaveBeenCalled();
    expect(options.map((o) => o.valueReference?.display)).toEqual(['Aetna', 'Other']);
  });

  it('returns just the RCM payers and "Other" when there are no custom orgs', async () => {
    const { oystehr, execute } = makeOystehr();
    execute.mockResolvedValue({ output: { organizations: [] } });

    const options = await getAllInsurancePayers(oystehr);

    expect(options.map((o) => o.valueReference?.display)).toEqual(['Aetna', 'Other']);
  });
});
