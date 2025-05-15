import Oystehr from '@oystehr/sdk';
import {
  Encounter,
  HealthcareService,
  Location,
  LocationHoursOfOperation,
  Practitioner,
  Resource,
  Schedule,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getClosingTime, getOpeningTime, isClosureOverride } from '../helpers';
import {
  AvailableLocationInformation,
  HOURS_OF_OPERATION_FORMAT,
  OVERRIDE_DATE_FORMAT,
  ScheduleListItem,
  ScheduleType,
  TelemedLocation,
  TIMEZONES,
} from '../types';
import { DOW, getScheduleDetails, getTimezone } from '../utils';
import { PUBLIC_EXTENSION_BASE_URL, SLUG_SYSTEM } from './constants';

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

  const locationToScheduleMap = new Map<string, Schedule | undefined>();
  resources.forEach((res) => {
    const isSchedule = res.resourceType === 'Schedule';
    if (isSchedule) {
      const actor = res.actor?.find((a) => a.reference?.startsWith('Location'))?.reference;
      if (actor) {
        const locationId = actor.split('/')[1];
        locationToScheduleMap.set(locationId, res);
      }
    }
  });

  const listToFilter = telemedLocations.map((location) => ({
    state: location.address?.state || '',
    available: location.status === 'active',
    schedule: locationToScheduleMap.get(location.id ?? ''),
    locationInformation: getLocationInformation(oystehr, location),
  }));
  const filteredLocations = listToFilter.filter((location) => location.state && location.schedule) as TelemedLocation[];
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

// todo 1.8: this needs to take a schedule (or be async and go get a schedule), have a better name
// also check that this data is truly needed everywhere it is used
export function getLocationInformation(
  oystehr: Oystehr,
  scheduleResource: Location | Practitioner | HealthcareService,
  currentDate: DateTime = DateTime.now()
): AvailableLocationInformation {
  const slug = scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value;
  const timezone = getTimezone(scheduleResource);

  const schedule = getScheduleDetails(scheduleResource);
  const scheduleOverrides = schedule?.scheduleOverrides || {};

  let scheduleType: ScheduleType;
  switch (scheduleResource?.resourceType) {
    case 'Location':
      scheduleType = ScheduleType['location'];
      break;
    case 'HealthcareService':
      scheduleType = ScheduleType['group'];
      break;
    case 'Practitioner':
      scheduleType = ScheduleType['provider'];
      break;
  }

  // Modify hours of operation returned based on schedule overrides
  let hoursOfOperation: LocationHoursOfOperation[] | undefined = undefined;
  if (scheduleResource.resourceType === 'Location') {
    hoursOfOperation = scheduleResource.hoursOfOperation;
    currentDate = currentDate.setZone(timezone);
    const overrideDate = Object.keys(scheduleOverrides).find((date) => {
      return currentDate.toFormat(OVERRIDE_DATE_FORMAT) === date;
    });
    if (overrideDate) {
      const dayOfWeek = currentDate.toFormat('EEE').toLowerCase();
      const override = scheduleOverrides[overrideDate];
      const dayIndex = hoursOfOperation?.findIndex((hour) => (hour.daysOfWeek as string[])?.includes(dayOfWeek));
      if (hoursOfOperation && typeof dayIndex !== 'undefined' && dayIndex >= 0) {
        hoursOfOperation[dayIndex].openingTime = DateTime.fromFormat(override.open.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
        hoursOfOperation[dayIndex].closingTime = DateTime.fromFormat(override.close.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
      }
    }
  }

  return {
    id: scheduleResource.id,
    slug: slug,
    name: getName(oystehr, scheduleResource),
    description: undefined,
    address: undefined,
    telecom: scheduleResource.telecom,
    hoursOfOperation: hoursOfOperation,
    timezone: timezone,
    closures: schedule?.closures ?? [],
    otherOffices: [], // todo
    scheduleType,
  };
}

function getName(oystehrClient: Oystehr, item: Location | Practitioner | HealthcareService): string {
  if (!item.name) {
    return 'Unknown';
  }
  if (item.resourceType === 'Location') {
    return item.name;
  }
  if (item.resourceType === 'HealthcareService') {
    return item.name;
  }
  return oystehrClient.fhir.formatHumanName(item.name[0]);
}

export function getEncounterStatusHistoryIdx(encounter: Encounter, status: string): number {
  if (encounter.statusHistory) {
    return encounter.statusHistory.findIndex((history) => history.status === status && !history.period.end);
  } else {
    throw new Error('Encounter status history not found');
  }
}

export interface CheckOfficeOpenOutput {
  officeOpen: boolean;
  walkinOpen: boolean;
  prebookStillOpenForToday: boolean;
  officeHasClosureOverrideToday: boolean;
  officeHasClosureOverrideTomorrow: boolean;
}

export function checkOfficeOpen(location: AvailableLocationInformation): CheckOfficeOpenOutput {
  const timeNow = DateTime.now().setZone(location.timezone);
  const tomorrowDate = timeNow.plus({ days: 1 });
  const tomorrowOpeningTime = getOpeningTime(location.hoursOfOperation ?? [], location.timezone ?? '', tomorrowDate);

  const officeHasClosureOverrideToday = isClosureOverride(location.closures ?? [], location.timezone ?? '', timeNow);
  const officeHasClosureOverrideTomorrow =
    isClosureOverride(location.closures ?? [], location.timezone ?? '', tomorrowDate) &&
    tomorrowOpeningTime !== undefined;

  const todayOpeningTime = getOpeningTime(location.hoursOfOperation ?? [], location.timezone ?? '', timeNow);
  const todayClosingTime = getClosingTime(location.hoursOfOperation ?? [], location.timezone ?? '', timeNow);
  const prebookStillOpenForToday =
    todayOpeningTime !== undefined && (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));

  const officeOpen =
    todayOpeningTime !== undefined &&
    todayOpeningTime <= timeNow &&
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday;

  return {
    officeOpen,
    walkinOpen: officeOpen,
    prebookStillOpenForToday,
    officeHasClosureOverrideToday,
    officeHasClosureOverrideTomorrow,
  };
}

export const getHoursOfOperationForToday = (item: Schedule): ScheduleListItem['todayHoursISO'] => {
  const tz = getTimezone(item) ?? TIMEZONES[0];
  const dayOfWeek = DateTime.now().setZone(tz).toLocaleString({ weekday: 'long' }).toLowerCase();

  const scheduleTemp = getScheduleDetails(item);
  if (!scheduleTemp) {
    return undefined;
  }
  const scheduleDays = scheduleTemp.schedule;
  const scheduleDay = scheduleDays[dayOfWeek as DOW];
  let open: number = scheduleDay.open;
  let close: number = scheduleDay.close;
  const scheduleOverrides = scheduleTemp.scheduleOverrides;
  if (scheduleTemp.scheduleOverrides) {
    for (const dateKey in scheduleOverrides) {
      if (Object.hasOwnProperty.call(scheduleOverrides, dateKey)) {
        const date = DateTime.fromFormat(dateKey, OVERRIDE_DATE_FORMAT).setZone(tz).toISODate();
        const todayDate = DateTime.now().setZone(tz).toISODate();
        if (date === todayDate) {
          open = scheduleOverrides[dateKey].open;
          close = scheduleOverrides[dateKey].close;
        }
      }
    }
  }
  if (open !== undefined && close !== undefined) {
    const openTime = DateTime.now().setZone(tz).startOf('day').plus({ hours: open }).toISO();
    const closeTime = DateTime.now().setZone(tz).startOf('day').plus({ hours: close }).toISO();
    if (!openTime || !closeTime) {
      return undefined;
    }
    return {
      open: openTime,
      close: closeTime,
    };
  }
  return undefined;
};
