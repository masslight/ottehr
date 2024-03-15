import { FhirClient } from '@zapehr/sdk';
import { Location } from 'fhir/r4';

export async function getLocationResource(locationID: string, fhirClient: FhirClient): Promise<Location | undefined> {
  let response: Location | null = null;
  try {
    response = await fhirClient.readResource<Location>({
      resourceType: 'Location',
      resourceId: locationID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}
