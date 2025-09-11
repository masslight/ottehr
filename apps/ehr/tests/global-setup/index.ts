import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { FullConfig } from '@playwright/test';
import { randomUUID } from 'crypto';
import { Location, Schedule } from 'fhir/r4b';
import {
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  SCHEDULE_EXTENSION_URL,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
  unbundleBatchPostOutput,
  VirtualLocationBody,
} from 'utils';

const globalSetup = async (_config: FullConfig): Promise<void> => {
  // Global setup logic here
  // all we're doing is validating that the PLAYWRIGHT_SUITE_ID environment variable has been set as expected
  const processId = process.env.PLAYWRIGHT_SUITE_ID;
  if (!processId) {
    throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
  }
  if (!processId.startsWith('ehr-')) {
    throw new Error('PLAYWRIGHT_SUITE_ID must start with "ehr-". Current value: ' + processId);
  }
  const oystehr = await getOystehr(process.env as Record<string, string>);
  await makeTestVirtualLocationOutsidePracticeAreas(oystehr, processId);
};

async function getOystehr(
  ehrZambdaEnv: Record<string, string>,
  auth0ClientId?: string,
  auth0ClientSecret?: string
): Promise<Oystehr> {
  const tokenResponse = await fetch(ehrZambdaEnv.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: auth0ClientId || ehrZambdaEnv.AUTH0_CLIENT,
      client_secret: auth0ClientSecret || ehrZambdaEnv.AUTH0_SECRET,
      audience: ehrZambdaEnv.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });

  const tokenData = await tokenResponse.json();

  const oystehr = new Oystehr({
    accessToken: tokenData.access_token,
    projectId: ehrZambdaEnv.PROJECT_ID,
    services: {
      fhirApiUrl: ehrZambdaEnv.FHIR_API,
      projectApiUrl: ehrZambdaEnv.PROJECT_API,
    },
  });
  return oystehr;
}

export const makeTestVirtualLocationOutsidePracticeAreas = async (
  oystehr: Oystehr,
  processId: string
): Promise<void> => {
  await createTelemedLocation(
    {
      state: 'NC',
      name: 'Asheville',
      meta: {
        tag: [
          {
            system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
            code: processId,
            display: 'E2E Test Resource - Delete me!',
          },
        ],
      },
    },
    oystehr
  );
};

const createTelemedLocation = async (locationData: VirtualLocationBody, oystehr: Oystehr): Promise<void> => {
  const location: Location = {
    resourceType: 'Location',
    status: 'active',
    address: {
      state: locationData.state,
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
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
    ],
    identifier: [
      {
        system: SLUG_SYSTEM,
        value: locationData.name.replace(/\s/g, ''), // remove whitespace from the name
      },
    ],
    // managing organization will be added later after organizations are created
    name: locationData.name,
    meta: locationData.meta,
  };
  const createLocationRequest: BatchInputPostRequest<Location> = {
    method: 'POST',
    url: '/Location',
    resource: location,
    fullUrl: `urn:uuid:${randomUUID()}`,
  };

  /*
    for each location, we create a schedule with a json extension that will be used in calculating the available bookable
    slots for that location at any moment in time.
  */
  const locationSchedule: Schedule = {
    resourceType: 'Schedule',
    active: true,
    extension: [
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString:
          '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
      },
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
    ],
    actor: [
      {
        reference: createLocationRequest.fullUrl,
      },
    ],
  };

  const createScheduleRequest: BatchInputPostRequest<Schedule> = {
    method: 'POST',
    url: '/Schedule',
    resource: locationSchedule,
  };

  const fhirResponse = await oystehr.fhir.transaction<Location | Schedule>({
    requests: [createLocationRequest, createScheduleRequest],
  });
  const unbundled = unbundleBatchPostOutput<Location | Schedule>(fhirResponse);
  const fhirLocation = unbundled.find((resource) => resource.resourceType === 'Location') as Location;
  console.log(`Created fhir location: state: ${fhirLocation?.address?.state}, id: ${fhirLocation?.id}`);
  console.log(`Created fhir schedule: id: ${locationSchedule.id} for ${fhirLocation?.address?.state} location`);
};
export default globalSetup;
