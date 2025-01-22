import Oystehr, { User } from '@oystehr/sdk';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';

// ***
export async function getPatientsForUser(user: User, oystehr: Oystehr): Promise<Patient[]> {
  const resources = (
    await oystehr.fhir.search<Person | RelatedPerson | Patient>({
      resourceType: 'Person',
      params: [
        {
          name: 'telecom',
          value: user.name,
        },
        {
          name: '_include',
          value: 'Person:relatedperson',
        },
        {
          name: '_include:iterate',
          value: 'RelatedPerson:patient',
        },
      ],
    })
  ).unbundle();
  const resourcesTemp = resources.filter((resourceTemp) => resourceTemp.resourceType === 'Patient');
  return resourcesTemp as Patient[];
}

export async function userHasAccessToPatient(user: User, patientID: string, oystehr: Oystehr): Promise<boolean> {
  // Get all of the patients the user has access to,
  // get the ID for each patient,
  // check any of those patients match the patientID parameter,
  // if so return true otherwise return false
  return (await getPatientsForUser(user, oystehr)).map((patientTemp) => patientTemp.id).includes(patientID);
}

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
  return resources[0] as RelatedPerson;
}
