import Oystehr from '@oystehr/sdk';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import { ClinicalNioOption } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/patient/get-answer-options';

const NIO_ID_A = '11111111-1111-4111-8111-111111111111';
const NIO_ID_B = '22222222-2222-4222-8222-222222222222';
const LEGACY_ORG_ID = '33333333-3333-4333-8333-333333333333';

const OCC_MED_QUERY =
  'active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|occupational-medicine-employer';

const flags = vi.hoisted(() => ({ nonInsuranceOrganizationsEnabled: true }));
vi.mock('utils/lib/ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: flags }));

const nioOptions: ClinicalNioOption[] = [
  {
    id: NIO_ID_B,
    reference: getNioReferenceUrl(NIO_ID_B),
    name: 'UPS',
    employer: true,
    active: true,
    coversCategories: [],
  },
  {
    id: NIO_ID_A,
    reference: getNioReferenceUrl(NIO_ID_A),
    name: 'FedEx',
    employer: true,
    active: true,
    coversCategories: ['workers-comp'],
  },
];

function makeOystehr(): { oystehr: Oystehr; execute: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> } {
  const execute = vi.fn().mockResolvedValue({ output: { organizations: nioOptions } });
  const search = vi.fn().mockResolvedValue({
    unbundle: () => [{ resourceType: 'Organization', id: LEGACY_ORG_ID, name: 'Acme Industrial Corp', active: true }],
    link: undefined,
  });
  const oystehr = { zambda: { execute }, fhir: { search } } as unknown as Oystehr;
  return { oystehr, execute, search };
}

const occMedInput = (extra: Record<string, unknown> = {}): Parameters<typeof performEffect>[0] =>
  ({
    type: 'query',
    answerSource: {
      zambdaId: 'get-answer-options',
      resourceType: 'Organization',
      query: OCC_MED_QUERY,
      ...extra,
    },
  }) as Parameters<typeof performEffect>[0];

describe('get-answer-options NIO reroute', () => {
  beforeEach(() => {
    flags.nonInsuranceOrganizationsEnabled = true;
  });

  it('reroutes the occ-med employer query to the NIO directory and returns token options sorted by name', async () => {
    const { oystehr, execute, search } = makeOystehr();

    const options = await performEffect(occMedInput(), oystehr);

    expect(execute).toHaveBeenCalledWith({ id: 'list-non-insurance-organizations', employerOnly: true });
    expect(search).not.toHaveBeenCalled();
    expect(options).toEqual([
      { valueReference: { reference: getNioReferenceUrl(NIO_ID_A), display: 'FedEx' } },
      { valueReference: { reference: getNioReferenceUrl(NIO_ID_B), display: 'UPS' } },
    ]);
  });

  it("reroutes the EHR's variant too — the extra prependedIdentifier does not matter", async () => {
    const { oystehr, execute } = makeOystehr();
    await performEffect(occMedInput({ prependedIdentifier: '1' }), oystehr);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('leaves unrelated queries on the FHIR path', async () => {
    const { oystehr, execute, search } = makeOystehr();

    const options = await performEffect(
      occMedInput({ query: 'active:not=false&type=http://terminology.hl7.org/CodeSystem/organization-type|pharmacy' }),
      oystehr
    );

    expect(execute).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(options[0].valueReference?.reference).toBe(`Organization/${LEGACY_ORG_ID}`);
  });

  it('keeps the legacy FHIR path when the flag is off', async () => {
    flags.nonInsuranceOrganizationsEnabled = false;
    const { oystehr, execute, search } = makeOystehr();

    const options = await performEffect(occMedInput(), oystehr);

    expect(execute).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(options[0].valueReference?.display).toBe('Acme Industrial Corp');
  });
});
