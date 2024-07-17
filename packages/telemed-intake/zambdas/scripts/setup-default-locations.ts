import { FhirClient } from '@zapehr/sdk';
import { Location, Resource } from 'fhir/r4';
import { AllStates } from 'ottehr-utils';
import { TIMEZONE_EXTENSION } from '../src/shared';

export const checkTelemedVirtualLocations = async (fhirClient: FhirClient) => {
  const allTelemedLocations = await fhirClient.searchResources({
    resourceType: 'Location',
  });
  console.log('Received all locations from fhir.');

  const telemedStates: string[] = [];
  filterVirtualLocations(allTelemedLocations).map((location) => {
    if (location?.address && location.address.state) telemedStates.push(location.address.state);
  });
  console.log('Filtered all virtual telemed locations.');

  for (const statePkg of AllStates) {
    if (!telemedStates.includes(statePkg.value)) await createTelemedLocation(statePkg, fhirClient);
  }
  console.log('All locations exist');
};

const createTelemedLocation = async (state: { value: string; label: string }, fhirClient: FhirClient) => {
  const location: Location = {
    resourceType: 'Location',
    status: 'active',
    identifier: [{
      use: "usual",
      system: "https://fhir.ottehr.com/r4/slug",
      value: state.value.toLocaleLowerCase(),
    }],
    address: {
      state: state.value,
    },
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
        valueCoding: {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'vi',
          display: 'Virtual',
        },
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString: "{\"schedule\":{\"monday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"tuesday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"wednesday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"thursday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"friday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"saturday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]},\"sunday\":{\"open\":8,\"close\":15,\"openingBuffer\":0,\"closingBuffer\":0,\"workingDay\":true,\"hours\":[{\"hour\":8,\"capacity\":2},{\"hour\":9,\"capacity\":2},{\"hour\":10,\"capacity\":2},{\"hour\":11,\"capacity\":2},{\"hour\":12,\"capacity\":2},{\"hour\":13,\"capacity\":2},{\"hour\":14,\"capacity\":2},{\"hour\":15,\"capacity\":2},{\"hour\":16,\"capacity\":2},{\"hour\":17,\"capacity\":3},{\"hour\":18,\"capacity\":3},{\"hour\":19,\"capacity\":3},{\"hour\":20,\"capacity\":1}]}},\"scheduleOverrides\":{}}"
      },
      {
        url: TIMEZONE_EXTENSION,
        valueString: 'America/New_York',
      },
    ],
    name: `${state.label} virtual`,
  };
  await fhirClient.createResource(location);
  console.log('Created fhir location: "' + state.value + '".');
};

const filterVirtualLocations = (resources: Resource[]) => {
  const resultLocations: Location[] = [];
  resources.forEach((resource) => {
    if (resource.resourceType === 'Location') {
      const location = resource as Location;
      if (location.id && isLocationVirtual(location)) {
        resultLocations.push(location);
      }
    }
  });
  return resultLocations;
};

const isLocationVirtual = (location: Location): boolean => {
  return location.extension?.[0].valueCoding?.code === 'vi';
};
