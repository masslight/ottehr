import { FhirClient } from '@zapehr/sdk';
import { Encounter, Patient, Resource } from 'fhir/r4';

export interface PatientEnounter {
  encounter?: Encounter;
  patient?: Patient;
}

export async function getPatientEncounter(encounterId: string, fhirClient: FhirClient): Promise<PatientEnounter> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: '_id',
        value: encounterId!,
      },
      {
        name: '_include',
        value: 'Encounter:subject',
      },
    ],
  });

  const encounters: Encounter[] = resources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
  const patients: Patient[] = resources.filter((resource) => resource.resourceType === 'Patient') as Patient[];

  return {
    patient: patients[0],
    encounter: encounters[0],
  };
}
