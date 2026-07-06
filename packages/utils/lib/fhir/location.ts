import Oystehr from '@oystehr/sdk';
import { Encounter, HealthcareService, Location, Practitioner, PractitionerRole, Resource, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  OVERRIDE_DATE_FORMAT,
  ScheduleListItem,
  ScheduleType,
  TelemedLocation,
  TIMEZONES,
} from '../types';
import { DOW, getScheduleExtension, getTimezone } from '../utils';
import { PUBLIC_EXTENSION_BASE_URL, SLUG_SYSTEM } from './constants';
import { getAllFhirSearchPages } from './getAllFhirSearchPages';
import { getFullName } from './patient';

export const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;
export const LOCATION_PHYSICAL_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/location-physical-type';
export const LOCATION_VIRTUAL_CODE = 'vi';
export const LOCATION_FACILITY_GROUP_CODE = 'si';
// Project-specific "form" marker written on the same location-form extension.
// It is NOT a real HL7 location-physical-type code (that value set has no
// in-person member) — it mirrors the loose convention already used for
// 'vi' (virtual) and 'si' (facility group), which lets a Location be tagged
// as both virtual and in-person at once.
export const LOCATION_IN_PERSON_CODE = 'in-person';

const hasLocationFormCoding = (location: Location | Schedule, code: string): boolean =>
  Boolean(location.extension?.some((ext) => ext.url === LOCATION_FORM_EXTENSION_URL && ext.valueCoding?.code === code));

export const isLocationFacilityGroup = (location: Location): boolean => {
  return hasLocationFormCoding(location, LOCATION_FACILITY_GROUP_CODE);
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

export const isLocationVirtual = (location: Location | Schedule): location is Location => {
  // Use `.some` rather than `.find(...)?.code === 'vi'`: a Location may now carry
  // multiple codings on this URL (e.g. both virtual and in-person, plus a
  // facility-group 'si'), and `.find` only inspects whichever coding happens to
  // come first — which would silently break detection for dual-mode Locations.
  return hasLocationFormCoding(location, LOCATION_VIRTUAL_CODE);
};

/**
 * True when the Location should appear in in-person contexts (booking pick-lists,
 * lab-ordering locations, etc.). A Location can be both virtual and in-person.
 *
 * Backward-compat: Locations created before the in-person flag existed have no
 * explicit in-person coding, so they're treated as in-person unless they're
 * virtual — preserving the legacy "no location-form coding = physical location"
 * semantic. A virtual-only Location stays out of in-person lists until an admin
 * explicitly marks it in-person.
 */
export const isLocationInPerson = (location: Location | Schedule): boolean => {
  return hasLocationFormCoding(location, LOCATION_IN_PERSON_CODE) || !isLocationVirtual(location);
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
  const resources = await getAllFhirSearchPages<Location | Schedule>(
    {
      resourceType: 'Location',
      params: [
        {
          name: '_revinclude',
          value: 'Schedule:actor:Location',
        },
      ],
    },
    oystehr
  );

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

  const listToFilter = telemedLocations.map((location) => {
    const schedule = locationToScheduleMap.get(location.id ?? '');
    return {
      state: location.address?.state || '',
      available: location.status === 'active',
      schedule,
      locationInformation: schedule && getLocationInformation(location, schedule),
    };
  });
  const filteredLocations = listToFilter.filter(
    (location) => location.state && location.schedule && location.locationInformation
  ) as TelemedLocation[];
  return filteredLocations;
}

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
  scheduleResource: Location | Practitioner | PractitionerRole | HealthcareService,
  schedule?: Schedule
): AvailableLocationInformation {
  const slug = scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value;
  const timezone = schedule ? getTimezone(schedule) : getTimezone(scheduleResource);

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
    case 'PractitionerRole':
      // A PractitionerRole scheduleOwner surfaces as a "provider" for the
      // patient-facing flows — from the patient's perspective they're still
      // booking with a specific provider, just via the role binding.
      scheduleType = ScheduleType['provider'];
      break;
  }

  // Modify hours of operation returned based on schedule overrides
  return {
    id: scheduleResource.id,
    slug: slug,
    name: getName(scheduleResource),
    description: undefined,
    address: undefined,
    telecom: scheduleResource.telecom,
    timezone: timezone,
    otherOffices: [], // todo
    scheduleOwnerType: scheduleType,
    scheduleExtension: schedule && getScheduleExtension(schedule),
  };
}

function getName(item: Location | Practitioner | PractitionerRole | HealthcareService): string {
  if (item.resourceType === 'PractitionerRole') {
    // PractitionerRoles don't carry a display name — the caller should fetch
    // the underlying Practitioner for a pretty label. Return a role-id-scoped
    // placeholder so reports/UIs don't blow up.
    return `Role ${item.id ?? ''}`.trim() || 'Unknown';
  }
  if (!item.name) {
    return 'Unknown';
  }
  if (item.resourceType === 'Location') {
    return item.name;
  }
  if (item.resourceType === 'HealthcareService') {
    return item.name;
  }
  return getFullName(item);
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

export const getHoursOfOperationForToday = (item: Schedule): ScheduleListItem['todayHoursISO'] => {
  const tz = getTimezone(item) ?? TIMEZONES[0];
  const dayOfWeek = DateTime.now().setZone(tz).toLocaleString({ weekday: 'long' }, { locale: 'en-US' }).toLowerCase();

  const scheduleTemp = getScheduleExtension(item);
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
