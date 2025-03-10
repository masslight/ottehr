import Oystehr from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';

/**
 * passing idType you determine what resources you'll receive, patient means all orders for patient and encounter all orders for particular visit*/
export async function getInHouseMedicationsResources(apiClient: Oystehr, idType: 'patient' | 'encounter', id: string): Promise<FhirResource[]> {
  const params = {
    resourceType: 'MedicationAdministration',
    params: [
      {
        name: '_revinclude:iterate',
        value: 'MedicationStatement:part-of',
      },
    ],
  };
  if (idType === 'patient') {
    params.params.push({
      name: 'subject',
      value: `Patient/${id}`,
    })
  } else {
    params.params.push({
        name: 'context',
        value: id,
    });
  }
  return (await apiClient.fhir.search<FhirResource>(params)).unbundle();
}
