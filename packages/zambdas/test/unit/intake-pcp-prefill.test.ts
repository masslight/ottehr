import Oystehr from '@oystehr/sdk';
import { Patient, Practitioner } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';

const { storedPatient } = vi.hoisted(() => ({ storedPatient: { current: undefined as unknown } }));

vi.mock('../../src/ehr/shared/harvest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/shared/harvest')>()),
  getAccountAndCoverageResourcesForPatient: vi.fn(async () => ({
    patient: storedPatient.current,
    coverages: {},
    insuranceOrgs: [],
  })),
}));

const { getRelatedResources } = await import('../../src/patient/appointment/helpers');

const oystehr = { fhir: { search: vi.fn(async () => ({ unbundle: () => [] })) } } as unknown as Oystehr;

const pcp = (active?: boolean): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'primary-care-physician',
  ...(active === undefined ? {} : { active }),
  name: [{ family: 'Green', given: ['Olivia'] }],
});

const NO_PCP_CONFIRMED: Practitioner = { resourceType: 'Practitioner', id: 'primary-care-physician', active: false };

const UNRELATED: Practitioner = { resourceType: 'Practitioner', id: 'attending', name: [{ family: 'Other' }] };

const prefilledPcp = async (contained: Practitioner[]): Promise<Practitioner | undefined> => {
  const patient: Patient = {
    resourceType: 'Patient',
    id: 'patient-1',
    generalPractitioner: [{ reference: '#primary-care-physician' }],
    contained,
  };
  storedPatient.current = patient;

  const { accountInfo } = await getRelatedResources(oystehr, 'patient-1');

  return accountInfo?.primaryCarePhysician;
};

describe('patient paperwork PCP pre-fill', () => {
  it.each([
    ['an active PCP', true, pcp(true)],
    ['a PCP stored without an active flag', true, pcp()],
    ['a confirmed no-PCP', false, NO_PCP_CONFIRMED],
  ] as [string, boolean, Practitioner][])('%s is pre-filled: %s', async (_label, prefilled, stored) => {
    expect(await prefilledPcp([stored])).toEqual(prefilled ? stored : undefined);
  });

  it('ignores an unrelated Practitioner placed before the PCP', async () => {
    expect(await prefilledPcp([UNRELATED, pcp(true)])).toEqual(pcp(true));
  });

  it('does not pre-fill an unrelated Practitioner when the PCP is a confirmed no-PCP', async () => {
    expect(await prefilledPcp([UNRELATED, NO_PCP_CONFIRMED])).toBeUndefined();
  });
});
