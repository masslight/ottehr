import Oystehr from '@oystehr/sdk';
import { Encounter, Patient } from 'fhir/r4b';

export interface PatientEncounter {
  encounter?: Encounter;
  patient?: Patient;
}

export async function getPatientEncounter(encounterId: string, oystehr: Oystehr): Promise<PatientEncounter> {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId!,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
      ],
    })
  ).unbundle();

  const encounters: Encounter[] = resources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
  const patients: Patient[] = resources.filter((resource) => resource.resourceType === 'Patient') as Patient[];

  return {
    patient: patients[0],
    encounter: encounters[0],
  };
}
