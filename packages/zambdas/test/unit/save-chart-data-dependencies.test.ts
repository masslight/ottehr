import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, MedicationRequest } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { getEncounterAndRelatedResources } from '../../src/shared/chart-data/encounter-resources';

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

const client = (included: FhirResource[] = [encounter]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn().mockResolvedValue({
    total: 1,
    entry: [{ search: { mode: 'match' }, resource: encounter }],
    unbundle: () => included,
  });
  return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
};

describe('encounter resource loading', () => {
  it('loads the minimal delete dependencies with one plain search by default', async () => {
    const { oystehr, search } = client();
    expect(await getEncounterAndRelatedResources(oystehr, 'visit')).toEqual([encounter]);
    expect(search).toHaveBeenCalledExactlyOnceWith({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: 'visit' },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },
        { name: '_revinclude:iterate', value: 'DocumentReference:encounter' },
      ],
    });
  });
  it('loads chart data for ordinary saves without requesting totals or paging', async () => {
    const { oystehr, search } = client();
    expect(await getEncounterAndRelatedResources(oystehr, 'visit', { includeChartData: true })).toEqual([encounter]);
    expect(search).toHaveBeenCalledTimes(1);
    const params: { name: string; value: string }[] = search.mock.calls[0][0].params;
    expect(params).toEqual(
      expect.arrayContaining([
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
        { name: '_revinclude:iterate', value: 'Observation:encounter' },
        { name: '_include', value: 'Encounter:location' },
      ])
    );
    expect(params.some(({ name }) => ['_total', '_count', '_offset'].includes(name))).toBe(false);
    expect(params.some(({ value }) => value === 'MedicationRequest:encounter')).toBe(false);
  });
  it('loads all chart and medication dependencies before procedure cleanup', async () => {
    const included = [encounter, medication];
    const { oystehr, search } = client(included);
    expect(await getEncounterAndRelatedResources(oystehr, 'visit', { includeProcedureDependencies: true })).toEqual(
      included
    );
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].params).toEqual(
      expect.arrayContaining([
        { name: '_id', value: 'visit' },
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
        { name: '_revinclude:iterate', value: 'MedicationRequest:encounter' },
        { name: '_revinclude:iterate', value: 'MedicationAdministration:context' },
      ])
    );
  });
  it('rejects a missing encounter ID before querying', async () => {
    const { oystehr, search } = client();
    await expect(getEncounterAndRelatedResources(oystehr)).rejects.toThrow('Encounter ID is required');
    expect(search).not.toHaveBeenCalled();
  });
});
