import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, MedicationRequest } from 'fhir/r4b';
import { expect, it, vi } from 'vitest';
import { getEncounterAndRelatedResources } from '../../src/shared/chart-data/encounter-resources';

it('loads prescription and administration dependencies with the encounter before procedure cleanup', async () => {
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'visit',
    status: 'in-progress',
    class: { code: 'AMB' },
  };
  const medication: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: 'medication',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient' },
    medicationCodeableConcept: { text: 'Medication' },
    reasonReference: [{ reference: 'Condition/diagnosis' }],
  };
  const included: FhirResource[] = [encounter, medication];
  const search = vi.fn().mockResolvedValue({
    total: 1,
    entry: [{ search: { mode: 'match' }, resource: encounter }],
    unbundle: () => included,
  });
  const client = { fhir: { search } } as unknown as Oystehr;
  expect(await getEncounterAndRelatedResources(client, 'visit', true)).toEqual(included);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search.mock.calls[0][0].params).toEqual(
    expect.arrayContaining([
      { name: '_id', value: 'visit' },
      { name: '_revinclude:iterate', value: 'MedicationRequest:encounter' },
      { name: '_revinclude:iterate', value: 'MedicationAdministration:context' },
    ])
  );
});
