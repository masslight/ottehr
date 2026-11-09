import { ServiceRequest } from 'fhir/r4b';
import { IN_HOUSE_TEST_CODE_SYSTEM } from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { describe, expect, it } from 'vitest';
import { makeEncounterLabResults } from '../../src/ehr/lab/shared/labs';

const serviceRequest = (
  id: string,
  status: ServiceRequest['status'],
  system: string,
  text: string
): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status,
  intent: 'order',
  subject: { reference: 'Patient/p' },
  code: { coding: [{ system, code: id }], text },
});

describe('makeEncounterLabResults', () => {
  it('reports in-house tests ordered but not yet collected apart from pending results', async () => {
    const { inHouseLabResultConfig, externalLabResultConfig } = await makeEncounterLabResults(
      [
        serviceRequest('ordered', 'draft', IN_HOUSE_TEST_CODE_SYSTEM, 'Rapid Strep'),
        serviceRequest('collected', 'active', IN_HOUSE_TEST_CODE_SYSTEM, 'Rapid Influenza'),
        serviceRequest('external-draft', 'draft', OYSTEHR_LAB_OI_CODE_SYSTEM, 'CBC'),
      ],
      'token'
    );

    expect(inHouseLabResultConfig.testsOrdered).toEqual(['Rapid Strep']);
    expect(inHouseLabResultConfig.resultsPending).toEqual(['Rapid Influenza']);
    expect(externalLabResultConfig.resultsPending).toBeUndefined();
  });

  it('leaves testsOrdered undefined when nothing is waiting on collection', async () => {
    const { inHouseLabResultConfig } = await makeEncounterLabResults(
      [serviceRequest('collected', 'active', IN_HOUSE_TEST_CODE_SYSTEM, 'Rapid Influenza')],
      'token'
    );
    expect(inHouseLabResultConfig.testsOrdered).toBeUndefined();
  });
});
