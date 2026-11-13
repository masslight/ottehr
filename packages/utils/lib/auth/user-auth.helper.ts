import Oystehr, { User } from '@oystehr/sdk';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';

export interface UserAccount {
  person?: Person;
  relatedPersons: RelatedPerson[];
  patients: Patient[];
}

export async function getAccountForUser(user: User, oystehr: Oystehr): Promise<UserAccount> {
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

  return {
    person: resources.find((r): r is Person => r.resourceType === 'Person'),
    relatedPersons: resources.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson'),
    patients: resources.filter((r): r is Patient => r.resourceType === 'Patient' && r.active !== false),
  };
}

export async function getPatientsForUser(user: User, oystehr: Oystehr): Promise<Patient[]> {
  console.time(`Getting patients for user: ${user.name}`);
  console.log(`User: ${JSON.stringify(user.name)}`);
  const { patients } = await getAccountForUser(user, oystehr);
  console.timeEnd(`Getting patients for user: ${user.name}`);

  return patients;
}

export async function getRelatedPersonsForPatient(patientID: string, oystehr: Oystehr): Promise<RelatedPerson[]> {
  console.log(`getting user-relatedpersons for patient with id ${patientID}`);
  return (
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
}

/**
 * @deprecated A Patient may have zero-to-many `user-relatedperson` RelatedPersons.
 * Use {@link getRelatedPersonsForPatient} and handle the array explicitly
 * (`if (!rps.length) …`), rather than relying on an arbitrary first pick.
 */
export async function getRelatedPersonForPatient(
  patientID: string,
  oystehr: Oystehr
): Promise<RelatedPerson | undefined> {
  const resources = await getRelatedPersonsForPatient(patientID, oystehr);
  return resources[0];
}
