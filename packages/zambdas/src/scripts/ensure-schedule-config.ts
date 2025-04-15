import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { FhirResource, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  SCHEDULE_EXTENSION_URL,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { getAuth0Token } from '../shared';
import { createOystehrClient } from '../shared';
import fs from 'fs';

type EnsureScheduleResult =  { telemedError: null | Error, inPersonGroupError: null | Error };
const ensureSchedules = async (envConfig: any): Promise<EnsureScheduleResult> => {
  const token = await getAuth0Token(envConfig);

  const results: EnsureScheduleResult = { telemedError: null, inPersonGroupError: null };

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehrClient = createOystehrClient(token, envConfig);
  // setup telemed location schedules
  try {
    const telemedLocationAndSchedules = (await oystehrClient.fhir.search<Location|Schedule>({
      resourceType: 'Location',
      params: [{
        name: 'status',
        value: 'active',
      },
      {
        name: '_revinclude',
        value: 'Schedule:actor:Location',
      }
    ],
    })).unbundle();

    const schedules = telemedLocationAndSchedules.filter((sched) => sched.resourceType === 'Schedule') as Schedule[];
    const telemedLocations = telemedLocationAndSchedules.filter((loc) => loc.resourceType === 'Location') as Location[];

    const schedulePostRequests: BatchInputPostRequest<Schedule>[] = [];
    const locationUpdateRequests: BatchInputPutRequest<Location>[] = [];

    telemedLocations.forEach((location) => {
       const existingSchedule = schedules.find((sched) => sched.actor?.some((act) => act.reference === `Location/${location.id}`));
       const extension = location.extension ?? [];

       const scheduleExtension = extension.find((ext) => ext.url === SCHEDULE_EXTENSION_URL);
       const timezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL);

       const newExtension = extension.filter((ext) => ext.url !== SCHEDULE_EXTENSION_URL);
       const modifiedLocation: Location = {
         ...location,
         extension: [
           ...newExtension,
         ],
       };
       if (scheduleExtension && timezoneExtension && existingSchedule === undefined) {
        const locationSchedule: Schedule = {
          resourceType: 'Schedule',
          active: true,
          extension: [
            { ...scheduleExtension },
            { ...timezoneExtension},
          ],
          actor: [{
            reference: `Location/${location.id}`,
          }],
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
    });
    
    await oystehrClient.fhir.transaction<FhirResource>({
      requests: [
        ...schedulePostRequests,
        //...locationUpdateRequests, // uncomment to remove schedule json from locations
      ],
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

    const practitionersAndSchedules = (await oystehrClient.fhir.search<HealthcareService|PractitionerRole|Practitioner|Schedule>({
      resourceType: 'HealthcareService',
      params: [{
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
      }
    ],
    })).unbundle();

    const schedules = practitionersAndSchedules.filter((sched) => sched.resourceType === 'Schedule') as Schedule[];
    const practitioners = practitionersAndSchedules.filter((pract) => pract.resourceType === 'Practitioner') as Practitioner[];

    const schedulePostRequests: BatchInputPostRequest<Schedule>[] = [];
    const practitionerUpdateRequests: BatchInputPutRequest<Practitioner>[] = [];

    practitioners.forEach((practitioner) => {
      const existingSchedule = schedules.find((sched) => sched.actor?.some((act) => act.reference === `Practitioner/${practitioner.id}`));
      const extension = practitioner.extension ?? [];

      const scheduleExtension = extension.find((ext) => ext.url === SCHEDULE_EXTENSION_URL);
      const timezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL) ?? {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      };

      const newExtension = extension.filter((ext) => ext.url !== SCHEDULE_EXTENSION_URL && ext.url !== TIMEZONE_EXTENSION_URL);
      const modifiedPractitioner: Practitioner = {
        ...practitioner,
        extension: [
          ...newExtension,
        ],
      };

      if (!existingSchedule && scheduleExtension && timezoneExtension) {
        const practitionerSchedule: Schedule = {
          resourceType: 'Schedule',
          active: true,
          extension: [
            { ...scheduleExtension },
            { ...timezoneExtension},
          ],
          actor: [{
            reference: `Practitioner/${practitioner.id}`,
          }],
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

     //console.log('schedulePostRequests', schedulePostRequests.length);
     //console.log('practitionerUpdateRequests', practitionerUpdateRequests.length);
     //console.log('pracititioners', JSON.stringify(practitioners, null, 2));

    await oystehrClient.fhir.transaction<FhirResource>({
      requests: [
        ...schedulePostRequests,
        //...practitionerUpdateRequests, // uncomment to remove schedule json from practitioners
      ],
    });

  } catch (error) {
    console.error('Error setting up in person healthcare service practitioner schedules:', error);
    if (error instanceof Error) { 
      results.telemedError = error as any;
    } else {
      results.telemedError = new Error('Unknown error while setting up in person healthcare service practitioner schedules');
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
