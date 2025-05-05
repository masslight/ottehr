import Oystehr from '@oystehr/sdk';
import { Location, Resource, Schedule } from 'fhir/r4b';
import { PUBLIC_EXTENSION_BASE_URL } from './constants';
import { TelemedLocation } from '../types';

export const isLocationFacilityGroup = (location: Location): boolean => {
  return Boolean(
    location.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release')
      ?.valueCoding?.code === 'si'
  );
};

export async function getLocationResource(locationID: string, oystehr: Oystehr): Promise<Location | undefined> {
  let response: Location | null = null;
  try {
    response = await oystehr.fhir.get<Location>({
      resourceType: 'Location',
      id: locationID,
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

export const isLocationVirtual = (location: Location): boolean => {
  return Boolean(
    location.extension?.find((ext) => ext.url === `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`)?.valueCoding
      ?.code === 'vi'
  );
};

export const filterVirtualLocations = (resources: Resource[]): Location[] => {
  const checkIfLocation = (resource: Resource): resource is Location => {
    return Boolean(resource.id) && resource.resourceType === 'Location';
  };

  return resources.filter((resource): resource is Location => {
    return checkIfLocation(resource) && isLocationVirtual(resource);
  });
};

export async function getTelemedLocation(oystehr: Oystehr, state: string): Promise<Location | undefined> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'address-state',
          value: state,
        },
      ],
    })
  ).unbundle();

  return resources.find((location) => isLocationVirtual(location));
}

export async function getTelemedLocations(oystehr: Oystehr): Promise<TelemedLocation[] | undefined> {
  const resources = (
    await oystehr.fhir.search<Location | Schedule>({
      resourceType: 'Location',
      params: [
        {
          name: '_revinclude',
          value: 'Schedule:actor:Location',
        },
      ],
    })
  ).unbundle();

  const telemedLocations = resources.filter(
    (location) => location.resourceType === 'Location' && isLocationVirtual(location)
  ) as Location[];

  const locationToScheduleMap = new Map<string, string | undefined>();
  resources.forEach((res) => {
    const isSchedule = res.resourceType === 'Schedule';
    if (isSchedule) {
      const scheduleId = res.id;
      const actor = res.actor?.find((a) => a.reference?.startsWith('Location'))?.reference;
      if (actor) {
        const locationId = actor.split('/')[1];
        locationToScheduleMap.set(locationId, scheduleId);
      }
    }
  });

  const listToFilter = telemedLocations.map((location) => ({
    state: location.address?.state || '',
    available: location.status === 'active',
    scheduleId: locationToScheduleMap.get(location.id ?? ''),
  }));
  const filteredLocations = listToFilter.filter(
    (location) => location.state && location.scheduleId
  ) as TelemedLocation[];
  return filteredLocations;
}

export const TELEMED_INITIAL_STATES = ['NJ', 'OH'];

export const defaultLocation: Location = {
  resourceType: 'Location',
  status: 'active',
  name: 'Testing',
  description: 'Test description',
  address: {
    use: 'work',
    type: 'physical',
    line: ['12345 Test St'],
    city: 'Test City',
    state: 'Test State',
    postalCode: '12345',
  },
  telecom: [
    {
      system: 'phone',
      use: 'work',
      value: '1234567890',
    },
    {
      system: 'url',
      use: 'work',
      value: 'https://example.com',
    },
  ],
  hoursOfOperation: [
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['mon'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['tue'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '00:00:00',
      daysOfWeek: ['wed'],
    },
    {
      openingTime: '18:00:00',
      daysOfWeek: ['thu'],
    },
    {
      openingTime: '14:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['fri'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sat'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sun'],
    },
  ],
};
