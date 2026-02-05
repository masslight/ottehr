import Oystehr from '@oystehr/sdk';
import { Patient, RelatedPerson } from 'fhir/r4b';
import { convertFhirNameToDisplayName } from 'utils';

export async function getRelatedPersonForPatient(
  patientID: string,
  oystehr: Oystehr
): Promise<RelatedPerson | undefined> {
  console.log(`getting user-relatedperson for patient with id ${patientID}`);
  const resources = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        {
          name: 'patient',
          value: `Patient/${patientID}`,
        },
        {
          name: 'relationship',
          value: 'user-relatedperson',
        },
      ],
    })
  ).unbundle();

  if (resources.length !== 1) {
    return undefined;
  }
  return resources[0];
}

export async function getPatientResourceById(patientId: string, oystehr: Oystehr): Promise<Patient> {
  return oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientId,
  });
}

export const getPatientName = async (patientId: string, oystehr: Oystehr): Promise<string | undefined> => {
  const patient = await getPatientResourceById(patientId, oystehr);
  if (patient?.name?.[0]) {
    return convertFhirNameToDisplayName(patient.name?.[0]);
  }
  return undefined;
};

export function getPatientLastFirstName(patient: Patient): string | undefined {
  const name = patient.name;
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;
  // const suffix = name?.[0]?.suffix?.[0];
  const isFullName = !!firstName && !!lastName;
  return isFullName ? `${lastName}, ${firstName}` : undefined;
  // const isFullName = !!firstName && !!lastName && !!suffix;
  // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
}
