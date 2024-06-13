import { FhirClient } from '@zapehr/sdk';
import { Patient, RelatedPerson, Resource } from 'fhir/r4';
import { convertFhirNameToDisplayName } from 'ehr-utils';

export async function getRelatedPersonForPatient(
  patientID: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson | undefined> {
  console.log(`getting user-relatedperson for patient with id ${patientID}`);
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'RelatedPerson',
    searchParams: [
      {
        name: 'patient',
        value: `Patient/${patientID}`,
      },
      {
        name: 'relationship',
        value: 'user-relatedperson',
      },
    ],
  });

  if (resources.length !== 1) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}

export async function getPatientResourceById(patientId: string, fhirClient: FhirClient): Promise<Patient> {
  return fhirClient.readResource({
    resourceType: 'Patient',
    resourceId: patientId,
  });
}

export const getPatientName = async (patientId: string, fhirClient: FhirClient): Promise<string | undefined> => {
  const patient = await getPatientResourceById(patientId, fhirClient);
  if (patient?.name?.[0]) {
    return convertFhirNameToDisplayName(patient.name?.[0]);
  }
  return undefined;
};
