import Oystehr, { User } from '@oystehr/sdk';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';

// ***
export async function getPatientsForUser(user: User, oystehr: Oystehr): Promise<Patient[]> {
  console.time(`Getting patients for user: ${user.name}`);
  console.log(`User: ${JSON.stringify(user.name)}`);
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
  console.timeEnd(`Getting patients for user: ${user.name}`);
  // console.log(`Get patients for user resources: ${JSON.stringify(resourcesTemp)}`);
  return resourcesTemp as Patient[];
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
