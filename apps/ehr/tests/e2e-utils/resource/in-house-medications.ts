import Oystehr, { FhirSearchParams } from '@oystehr/sdk';
import { MedicationAdministration, MedicationStatement } from 'fhir/r4b';

/**
 * passing idType you determine what resources you'll receive, patient means all orders for patient and encounter all orders for particular visit*/
export async function getInHouseMedicationsResources(
  apiClient: Oystehr,
  idType: 'patient' | 'encounter',
  id: string
): Promise<(MedicationAdministration | MedicationStatement)[]> {
  const params: FhirSearchParams<MedicationAdministration> = {
    resourceType: 'MedicationAdministration',
    params: [
      {
        name: '_revinclude:iterate',
        value: 'MedicationStatement:part-of',
      },
      ...(idType === 'patient'
        ? [
            {
              name: 'subject',
              value: `Patient/${id}`,
            },
          ]
        : [
            {
              name: 'context',
              value: `Encounter/${id}`,
            },
          ]),
    ],
  };
  return (await apiClient.fhir.search<MedicationAdministration | MedicationStatement>(params)).unbundle();
}
