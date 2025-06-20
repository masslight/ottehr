import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { FhirResource, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  isLocationVirtual,
  ROOM_EXTENSION_URL,
  SCHEDULE_EXTENSION_URL,
  SlotServiceCategory,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { getAuth0Token } from '../shared';
import { createOystehrClient } from '../shared';
import fs from 'fs';

type EnsureScheduleResult = { telemedError: null | Error; inPersonGroupError: null | Error };
const ensureSchedules = async (envConfig: any): Promise<EnsureScheduleResult> => {
  const token = await getAuth0Token(envConfig);

  const results: EnsureScheduleResult = { telemedError: null, inPersonGroupError: null };

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehrClient = createOystehrClient(token, envConfig);
  // setup telemed location schedules
  try {
    const locationAndSchedules = (
      await oystehrClient.fhir.search<Location | Schedule>({
        resourceType: 'Location',
        params: [
          {
            name: 'status',
            value: 'active',
          },
          {
            name: '_revinclude',
            value: 'Schedule:actor:Location',
          },
        ],
      })
    ).unbundle();

    const schedules = locationAndSchedules.filter((sched) => sched.resourceType === 'Schedule') as Schedule[];
    const locations = locationAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];
    console.log('locations count: ', locations.length);

    const schedulePostRequests: BatchInputPostRequest<Schedule>[] = [];
    const locationUpdateRequests: BatchInputPutRequest<Location>[] = [];

    locations.forEach((location) => {
      const existingSchedule = schedules.find(
        (sched) => sched.actor?.some((act) => act.reference === `Location/${location.id}`)
      );
      const extension = location.extension ?? [];
      const isVirtual = isLocationVirtual(location);

      const scheduleExtension = extension.find((ext) => ext.url === SCHEDULE_EXTENSION_URL);
      const timezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL);

      const newExtension = extension.filter((ext) => ext.url !== SCHEDULE_EXTENSION_URL);

      const roomExtensions = extension.filter((ext) => ext.url === ROOM_EXTENSION_URL);
      const newRoomExtensions =
        !isVirtual && roomExtensions.length === 0
          ? Array.from({ length: 11 }, (_, i) => ({
              url: ROOM_EXTENSION_URL,
              valueString: (i + 1).toString(),
            }))
          : [];

      const modifiedLocation: Location = {
        ...location,
        extension: [...newExtension, ...newRoomExtensions],
      };

      // oystehr search bug prevents finding exact string match when there is a comma in the string
      if ((modifiedLocation.name?.split(',') ?? []).length > 1) {
        if (modifiedLocation.name === 'New York, NY') {
          modifiedLocation.name = 'New York';
        } else {
          modifiedLocation.name = modifiedLocation.name = modifiedLocation.name?.replace(',', '-');
        }
      }
      if (scheduleExtension && timezoneExtension && existingSchedule === undefined) {
        const locationSchedule: Schedule = {
          resourceType: 'Schedule',
          active: true,
          extension: [{ ...scheduleExtension }, { ...timezoneExtension }],
          actor: [
            {
              reference: `Location/${location.id}`,
            },
          ],
          serviceCategory: isVirtual
            ? [SlotServiceCategory.telehealthServiceMode]
            : [SlotServiceCategory.inPersonServiceMode],
        };
        schedulePostRequests.push({
          method: 'POST',
          url: '/Schedule',
          resource: locationSchedule,
        });
        locationUpdateRequests.push({
          method: 'PUT',
          url: `/Location/${location.id}`,
          resource: modifiedLocation,
        });
      }
      if (existingSchedule && scheduleExtension) {
        locationUpdateRequests.push({
          method: 'PUT',
          url: `/Location/${location.id}`,
          resource: modifiedLocation,
        });
      }
      if (
        newRoomExtensions.length > 0 &&
        !locationUpdateRequests.find((req) => req.url === `/Location/${location.id}`)
      ) {
        locationUpdateRequests.push({
          method: 'PUT',
          url: `/Location/${location.id}`,
          resource: modifiedLocation,
        });
      }
    });
    console.log('schedulePostRequests', schedulePostRequests.length);
    await oystehrClient.fhir.transaction<FhirResource>({
      requests: [...schedulePostRequests, ...locationUpdateRequests],
    });
  } catch (error) {
    console.error('Error setting up telemed locations:', error);
    if (error instanceof Error) {
      results.telemedError = error as any;
    } else {
      results.telemedError = new Error('Unknown error occurred while setting up telemed location schedules');
    }
  }

  // setup in person healthcare service practitioner schedules
  try {
    const practitionersAndSchedules = (
      await oystehrClient.fhir.search<HealthcareService | PractitionerRole | Practitioner | Schedule>({
        resourceType: 'HealthcareService',
        params: [
          {
            name: 'identifier',
            value: 'visit-followup-group',
          },
          {
            name: '_revinclude',
            value: 'PractitionerRole:service',
          },
          {
            name: '_include:iterate',
            value: 'PractitionerRole:practitioner',
          },
          {
            name: '_revinclude:iterate',
            value: 'Schedule:actor:Practitioner',
          },
        ],
      })
    ).unbundle();

    const schedules = practitionersAndSchedules.filter((sched) => sched.resourceType === 'Schedule') as Schedule[];
    const practitioners = practitionersAndSchedules.filter(
      (pract) => pract.resourceType === 'Practitioner'
    ) as Practitioner[];

    const schedulePostRequests: BatchInputPostRequest<Schedule>[] = [];
    const practitionerUpdateRequests: BatchInputPutRequest<Practitioner>[] = [];

    practitioners.forEach((practitioner) => {
      const existingSchedule = schedules.find(
        (sched) => sched.actor?.some((act) => act.reference === `Practitioner/${practitioner.id}`)
      );
      const extension = practitioner.extension ?? [];

      const scheduleExtension = extension.find((ext) => ext.url === SCHEDULE_EXTENSION_URL);
      const timezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL) ?? {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      };

      const newExtension = extension.filter(
        (ext) => ext.url !== SCHEDULE_EXTENSION_URL && ext.url !== TIMEZONE_EXTENSION_URL
      );
      const modifiedPractitioner: Practitioner = {
        ...practitioner,
        extension: [...newExtension],
      };

      if (!existingSchedule && scheduleExtension && timezoneExtension) {
        const practitionerSchedule: Schedule = {
          resourceType: 'Schedule',
          active: true,
          extension: [{ ...scheduleExtension }, { ...timezoneExtension }],
          actor: [
            {
              reference: `Practitioner/${practitioner.id}`,
            },
          ],
        };
        schedulePostRequests.push({
          method: 'POST',
          url: '/Schedule',
          resource: practitionerSchedule,
        });
        practitionerUpdateRequests.push({
          method: 'PUT',
          url: `/Practitioner/${practitioner.id}`,
          resource: modifiedPractitioner,
        });
      }
      if (existingSchedule && (scheduleExtension || timezoneExtension)) {
        practitionerUpdateRequests.push({
          method: 'PUT',
          url: `/Practitioner/${practitioner.id}`,
          resource: modifiedPractitioner,
        });
      }
    });

    console.log('schedulePostRequests', schedulePostRequests.length);
    //console.log('practitionerUpdateRequests', practitionerUpdateRequests.length);
    //console.log('pracititioners', JSON.stringify(practitioners, null, 2));

    await oystehrClient.fhir.transaction<FhirResource>({
      requests: [...schedulePostRequests, ...practitionerUpdateRequests],
    });
  } catch (error) {
    console.error('Error setting up in person healthcare service practitioner schedules:', error);
    if (error instanceof Error) {
      results.telemedError = error as any;
    } else {
      results.telemedError = new Error(
        'Unknown error while setting up in person healthcare service practitioner schedules'
      );
    }
  }
  return results;
};

// Main

const main = async (): Promise<void> => {
  const env = process.argv[2];

  const envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  const { telemedError, inPersonGroupError } = await ensureSchedules(envConfig);
  if (telemedError === null && inPersonGroupError === null) {
    console.log('Schedule resources configured successfully');
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
