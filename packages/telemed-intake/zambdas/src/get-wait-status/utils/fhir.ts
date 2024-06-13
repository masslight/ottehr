import { FhirClient } from '@zapehr/sdk';
import { Appointment, Location } from 'fhir/r4';
import { isLocationVirtual } from './helpers';

export const getAllAppointmentsByLocations = async (
  fhirClient: FhirClient,
  locationsIds: string[],
): Promise<Appointment[]> => {
  const allResources = await fhirClient.searchResources({
    resourceType: 'Appointment',
    searchParams: [
      {
        name: 'location',
        value: locationsIds.map((locationId) => 'Location/' + locationId).join(','),
      },
      {
        name: '_has:Encounter:appointment:status',
        value: 'planned',
      },
    ],
  });
  return allResources as Appointment[];
};

export const convertStatesAbbreviationsToLocationIds = async (
  fhirClient: FhirClient,
  statesAbbreviations: string[],
): Promise<string[]> => {
  const statesLocationIds: string[] = [];
  const searchParams = {
    resourceType: 'Location',
    searchParams: [
      {
        name: 'address-state',
        value: statesAbbreviations.join(','),
      },
    ],
  };
  const resources = await fhirClient.searchResources(searchParams);
  resources.forEach((resource) => {
    if (resource && resource.resourceType === 'Location') {
      const location = resource as Location;
      if (location.id && isLocationVirtual(location)) {
        statesLocationIds.push(location.id);
      }
    }
  });
  return statesLocationIds;
};
