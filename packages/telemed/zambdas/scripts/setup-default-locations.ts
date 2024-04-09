import { FhirClient } from '@zapehr/sdk';
import { Location, Resource } from 'fhir/r4';
import { AllStates } from 'ottehr-utils';

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
