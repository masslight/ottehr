import { isLocationVirtual } from 'utils/lib/fhir';
import { LOCATION_CONFIG } from 'utils/lib/ottehr-config/locations';
import { describe, expect } from 'vitest';
import locationsSpec from '../../../config/oystehr/locations-and-schedules.json' assert { type: 'json' };

describe('location config matches spec', () => {
  const inPersonLocationsFromSpec: string[] = [];
  const telemedLocationsFromSpec: string[] = [];

  Object.entries(locationsSpec.fhirResources).forEach(([_, value]: [string, any]) => {
    if (value.resource?.resourceType === 'Location') {
      const location = value.resource;
      const locationName = location.name;

      if (isLocationVirtual(location)) {
        telemedLocationsFromSpec.push(locationName);
      } else {
        inPersonLocationsFromSpec.push(locationName);
      }
    }
  });

  test('lengths match', () => {
    expect(inPersonLocationsFromSpec.length).toBe(LOCATION_CONFIG.inPersonLocations.length);
    expect(telemedLocationsFromSpec.length).toBe(LOCATION_CONFIG.telemedLocations.length);
  });

  test('in-person locations match', () => {
    const sortedInPersonConfig = [...LOCATION_CONFIG.inPersonLocations].sort();
    const sortedInPersonSpec = inPersonLocationsFromSpec.sort();
    expect(sortedInPersonConfig).toEqual(sortedInPersonSpec);
  });
  test('telemed locations match', () => {
    const sortedTelemedConfig = [...LOCATION_CONFIG.telemedLocations].sort();
    const sortedTelemedSpec = telemedLocationsFromSpec.sort();
    expect(sortedTelemedConfig).toEqual(sortedTelemedSpec);
  });
});
