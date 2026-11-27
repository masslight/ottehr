import { Patient, Practitioner, Questionnaire } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { makePrepopulatedItemsFromPatientRecord } from '../prePopulation';

const patient: Patient = { resourceType: 'Patient', id: 'test-patient' };

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  item: [
    {
      linkId: 'primary-care-physician-section',
      type: 'group',
      item: [
        { linkId: 'pcp-active', type: 'boolean' },
        { linkId: 'pcp-first', type: 'string' },
      ],
    },
  ],
};

const prepopulatePcp = (primaryCarePhysician?: Practitioner): Record<string, unknown> => {
  const [section] = makePrepopulatedItemsFromPatientRecord({
    patient,
    questionnaire,
    primaryCarePhysician,
    coverages: {},
    insuranceOrgs: [],
    coverageChecks: [],
  });
  return Object.fromEntries((section.item ?? []).map((item) => [item.linkId, item.answer?.[0]]));
};

describe('PCP pre-population for the patient record', () => {
  it('leaves the no-PCP box unticked when nothing is on file', () => {
    expect(prepopulatePcp(undefined)['pcp-active']).toEqual({ valueBoolean: true });
  });

  it('ticks the no-PCP box when the absence of a PCP was confirmed', () => {
    const confirmedNoPcp: Practitioner = { resourceType: 'Practitioner', id: 'primary-care-physician', active: false };
    expect(prepopulatePcp(confirmedNoPcp)['pcp-active']).toEqual({ valueBoolean: false });
  });

  it('leaves the no-PCP box unticked and fills the details for an active PCP', () => {
    const activePcp: Practitioner = {
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      active: true,
      name: [{ family: 'Green', given: ['Olivia'] }],
    };
    expect(prepopulatePcp(activePcp)).toEqual({
      'pcp-active': { valueBoolean: true },
      'pcp-first': { valueString: 'Olivia' },
    });
  });

  it('treats a PCP stored without an active flag as on file', () => {
    const pcpWithoutActiveFlag: Practitioner = {
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      name: [{ family: 'Green', given: ['Olivia'] }],
    };
    expect(prepopulatePcp(pcpWithoutActiveFlag)).toEqual({
      'pcp-active': { valueBoolean: true },
      'pcp-first': { valueString: 'Olivia' },
    });
  });
});
