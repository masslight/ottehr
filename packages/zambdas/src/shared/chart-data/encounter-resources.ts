import Oystehr from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';

export async function getEncounterAndRelatedResources(
  oystehr: Oystehr,
  encounterId?: string,
  includeProcedureDependencies = false
): Promise<FhirResource[]> {
  if (!encounterId) {
    throw new Error('Encounter ID is required');
  }
  return getAllFhirSearchPages<FhirResource>(
    {
      resourceType: 'Encounter',
      params: [
        ...(includeProcedureDependencies
          ? [
              { name: '_revinclude:iterate', value: 'MedicationRequest:encounter' },
              { name: '_revinclude:iterate', value: 'MedicationAdministration:context' },
            ]
          : []),
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_revinclude:iterate',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:encounter',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Condition:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'Observation:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'ClinicalImpression:encounter',
        },
      ],
    },
    oystehr
  );
}
