import { FhirClient, User } from '@zapehr/sdk';
import { Patient, RelatedPerson, Resource } from 'fhir/r4';

// ***
// The criteria need to be re-written completely
// ***
export async function getPatientsForUser(user: User, fhirClient: FhirClient): Promise<Patient[]> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Person',
    searchParams: [
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
  });
  const resourcesTemp = resources.filter((resourceTemp) => resourceTemp.resourceType === 'Patient');
  return resourcesTemp as Patient[];
}

export async function userHasAccessToPatient(user: User, patientID: string, fhirClient: FhirClient): Promise<boolean> {
  // Get all of the patients the user has access to,
  // get the ID for each patient,
  // check any of those patients match the patientID parameter,
  // if so return true otherwise return false
  return (await getPatientsForUser(user, fhirClient)).map((patientTemp) => patientTemp.id).includes(patientID);
}

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

export async function getPersonForPatient(
  patientID: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson | undefined> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Patient',
    searchParams: [
      {
        name: 'id',
        value: `Patient/${patientID}`,
      },
      {
        name: '_include',
        value: 'Patient:RelatedPerson',
      },
      {
        name: '_include',
        value: 'Person:RelatedPerson',
      },
    ],
  });

  if (resources.length !== 0) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}
