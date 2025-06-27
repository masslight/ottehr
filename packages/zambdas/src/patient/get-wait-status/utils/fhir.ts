import Oystehr, { FhirSearchParams } from '@oystehr/sdk';
import { Appointment, Location } from 'fhir/r4b';
import { isLocationVirtual, OTTEHR_MODULE } from 'utils';

/**
 * Retrieves all appointments that:
 * - Are associated with location group.
 * - Have a status of 'arrived'.
 * - Have an associated Encounter with a status of 'planned'.
 * - Contain a specific tag (OTTEHR_MODULE.TM).
 * - Are sorted by date.
 */

export const getAllAppointmentsByLocations = async (
  oystehr: Oystehr,
  locationsIds: string[]
): Promise<Appointment[]> => {
  const allResources = (
    await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        {
          name: 'location',
          value: locationsIds.map((locationId) => 'Location/' + locationId).join(','),
        },
        {
          name: 'status',
          value: 'arrived',
        },
        {
          name: '_has:Encounter:appointment:status',
          value: 'planned',
        },
        {
          name: '_tag',
          value: OTTEHR_MODULE.TM,
        },
        {
          name: '_sort',
          value: 'date',
        },
      ],
    })
  ).unbundle();
  return allResources;
};

export const convertStatesAbbreviationsToLocationIds = async (
  oystehr: Oystehr,
  statesAbbreviations: string[]
): Promise<string[]> => {
  const statesLocationIds: string[] = [];
  const searchParams: FhirSearchParams<Location> = {
    resourceType: 'Location',
    params: [
      {
        name: 'address-state',
        value: statesAbbreviations.join(','),
      },
    ],
  };
  const resources = (await oystehr.fhir.search<Location>(searchParams)).unbundle();
  resources.forEach((resource) => {
    if (resource.resourceType === 'Location' && resource.id && isLocationVirtual(resource as Location)) {
      statesLocationIds.push(resource.id);
    }
  });
  return statesLocationIds;
};
