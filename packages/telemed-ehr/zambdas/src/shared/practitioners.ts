import { AppClient, FhirClient, User } from '@zapehr/sdk';
import { Practitioner, Resource } from 'fhir/r4';

export async function getPractitionerResourceForUser(
  userId: User['id'],
  fhirClient: FhirClient,
  appClient: AppClient,
): Promise<Practitioner> {
  const user = await appClient.getUser(userId);
  if (!user) {
    throw new Error(`Can't find user with provided ID: ${userId}`);
  }
  try {
    const practitionerResource: Resource = await fhirClient.readResource({
      resourceType: 'Practitioner',
      resourceId: user.profile.replace('Practitioner/', ''),
    });

    return practitionerResource as Practitioner;
  } catch (error) {
    console.log(JSON.stringify(error));
    throw new Error(`Error occured while trying to get Practitioner resource for user ${userId}`);
  }
}
