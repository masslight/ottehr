import { input, password } from '@inquirer/prompts';
import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import dotenv from 'dotenv';
import { FhirResource, Location, Practitioner, Schedule } from 'fhir/r4b';
import fs from 'fs';
import {
  allLicensesForPractitioner,
  makeQualificationForPractitioner,
  SCHEDULE_EXTENSION_URL,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { isLocationVirtual } from 'utils/lib/fhir/location';
import {
  allPhysicalDefaultLocations,
  defaultGroup,
  virtualDefaultLocations,
} from '../packages/zambdas/src/scripts/setup-default-locations';

const getEnvironment = (): string => {
  const envFlagIndex = process.argv.findIndex((arg) => arg === '--environment');
  if (envFlagIndex !== -1 && envFlagIndex < process.argv.length - 1) {
    const env = process.argv[envFlagIndex + 1];
    const validEnvironments = ['local', 'demo', 'development', 'staging', 'testing'];
    if (validEnvironments.includes(env)) {
      return env;
    }
    console.warn(`Invalid environment "${env}". Using default "local".`);
  }
  return 'local';
};

const environment = getEnvironment();
console.log(`Using environment: ${environment}`);

interface EhrConfig {
  TEXT_USERNAME?: string;
  TEXT_PASSWORD?: string;
  AUTH0_CLIENT?: string;
  AUTH0_SECRET?: string;
  AUTH0_CLIENT_TESTS?: string;
  AUTH0_SECRET_TESTS?: string;
  LOCATION?: string;
  LOCATION_ID?: string;
  WEBSITE_URL?: string;
  FHIR_API?: string;
  AUTH0_ENDPOINT?: string;
  AUTH0_AUDIENCE?: string;
  [key: string]: any;
}

interface IntakeConfig {
  PHONE_NUMBER?: string;
  TEXT_USERNAME?: string;
  TEXT_PASSWORD?: string;
  SLUG_ONE?: string;
  STATE_ONE?: string;
  AUTH0_CLIENT?: string;
  AUTH0_SECRET?: string;
  LOCATION?: string;
  LOCATION_ID?: string;
  WEBSITE_URL?: string;
  FHIR_API?: string;
  AUTH0_ENDPOINT?: string;
  AUTH0_AUDIENCE?: string;
  PROJECT_API?: string;
  [key: string]: any;
}

async function getToken(
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

async function getLocationsForTesting(
  ehrZambdaEnv: Record<string, string>
): Promise<{ locationId: string; locationName: string; locationSlug: string; virtualLocationState: string }> {
  console.log(`Setting up locations for testing`);
  const oystehr = await getToken(ehrZambdaEnv);

  const firstDefaultLocation = allPhysicalDefaultLocations[0];
  const firstDefaultVirtualLocation = virtualDefaultLocations[0];

  const locationsResponse = await oystehr.fhir.search<Location | Schedule>({
    resourceType: 'Location',
    params: [
      {
        name: '_revinclude',
        value: 'Schedule:actor:Location',
      },
    ],
  });

  const defaultGroupRelatedResourcesResponse = await oystehr.fhir.search<Location | Practitioner | Schedule>({
    resourceType: 'HealthcareService',
    params: [
      {
        name: 'name',
        value: defaultGroup,
      },
      {
        name: '_include',
        value: 'HealthcareService:location',
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
        value: 'Schedule:actor:Location',
      },
      {
        name: '_revinclude:iterate',
        value: 'Schedule:actor:Practitioner',
      },
    ],
  });

  const defaultGroupRelatedResources = defaultGroupRelatedResourcesResponse.unbundle();

  const defaultGroupLocationsAndPractitioners = defaultGroupRelatedResources.filter(
    (res): res is Location | Practitioner => res.resourceType === 'Location' || res.resourceType === 'Practitioner'
  );

  const defaultGroupSchedules = defaultGroupRelatedResources.filter(
    (res): res is Schedule => res.resourceType === 'Schedule'
  );

  const locationsAndSchedules = locationsResponse.unbundle();
  const locations = locationsAndSchedules.filter((res): res is Location => res.resourceType === 'Location');
  const schedules = locationsAndSchedules.filter((res): res is Schedule => res.resourceType === 'Schedule');

  const virtualLocations = locations.filter(isLocationVirtual);

  if (locations.length === 0) {
    throw Error('No locations found in FHIR API');
  }

  if (virtualLocations.length === 0) {
    throw Error('No virtual locations found in FHIR API');
  }

  const locationResource = locations.find((location) => location.name === firstDefaultLocation.name);

  const locationId = locationResource?.id;
  const locationName = locationResource?.name;
  const locationSlug = locationResource?.identifier?.[0]?.value;

  const virtualLocation = virtualLocations.find(
    (location) => location.address?.state === firstDefaultVirtualLocation.state
  );
  const virtualLocationState = (virtualLocation?.address?.state || '').toLowerCase();

  if (!virtualLocation) {
    throw Error('Required virtual location not found');
  }

  if (!locationId) {
    throw Error('Required locationId not found  ');
  }

  if (!locationName) {
    throw Error('Required locationName not found');
  }

  if (!locationSlug) {
    throw Error('Required locationSlug not found');
  }

  if (!virtualLocationState) {
    throw Error('Required virtual location state not found');
  }

  console.log(`Found location by name '${locationResource.name}' with ID: ${locationId}`);
  console.log(`Location name: ${locationName}, slug: ${locationSlug}`);

  console.log(`Found virtual location by state: ${firstDefaultVirtualLocation.state} with ID: ${virtualLocation?.id}`);
  console.log(`Location name: ${virtualLocation?.name}, state: ${virtualLocation?.address?.state}`);

  console.group('Ensure test location schedules and slots');
  await Promise.all([
    ensureOwnerResourceSchedulesAndSlots(locationResource, schedules, oystehr),
    ensureOwnerResourceSchedulesAndSlots(virtualLocation, schedules, oystehr),
    defaultGroupLocationsAndPractitioners.map((owner) =>
      ensureOwnerResourceSchedulesAndSlots(owner, defaultGroupSchedules, oystehr)
    ),
  ]);
  console.groupEnd();

  return {
    locationId,
    locationName,
    locationSlug,
    virtualLocationState: virtualLocationState,
  };
}

async function setTestEhrUserCredentials(ehrConfig: EhrConfig): Promise<void> {
  console.log(`Setting up test EHR provider credentials`);
  const oystehr = await getToken(ehrConfig, ehrConfig.AUTH0_CLIENT_TESTS, ehrConfig.AUTH0_SECRET_TESTS);

  console.log(`Getting e2e test user by email: ${ehrConfig.TEXT_USERNAME}`);
  const users = await oystehr.user.listV2({ email: ehrConfig.TEXT_USERNAME! });
  const user = users.data.find((user) => user.email === ehrConfig.TEXT_USERNAME!);

  if (!user) {
    throw Error('e2e test user not found');
  }

  const practitionersResponse = await oystehr.fhir.search<Practitioner>({
    resourceType: 'Practitioner',
    params: [
      {
        name: '_id',
        value: user.profile.replace(`Practitioner/`, ''),
      },
    ],
  });

  const practitioners = practitionersResponse.unbundle();

  const practitioner = practitioners.at(0);

  if (!practitioner) {
    throw Error('e2e test user profile practitioner not found');
  }
  const locationsResponse = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: [
      {
        name: 'address-state:missing',
        value: 'false',
      },
    ],
  });

  const virtualLocations = locationsResponse.unbundle().filter(isLocationVirtual);

  if (virtualLocations.length === 0) {
    throw Error('No virtual locations found in FHIR API');
  }
  const firstDefaultVirtualLocation = virtualDefaultLocations[0];

  const licenses = allLicensesForPractitioner(practitioner);
  const qualification = practitioner.qualification || [];
  if (!licenses.find((license) => license.state === firstDefaultVirtualLocation.state)) {
    qualification.push(
      makeQualificationForPractitioner({
        state: firstDefaultVirtualLocation.state,
        number: '1234567890',
        code: 'MD',
        active: true,
      })
    );

    try {
      await oystehr.fhir.update<Practitioner>({
        id: practitioner.id!,
        ...practitioner,
        qualification,
      });
    } catch (error) {
      console.error('Error updating e2e test practitioner qualifications', error);
      throw error;
    }
  }
}

export async function createTestEnvFiles(): Promise<void> {
  try {
    const skipPrompts = process.argv.includes('--skip-prompts');

    const zambdaEnv: Record<string, string> = JSON.parse(
      fs.readFileSync(`packages/zambdas/.env/${environment}.json`, 'utf8')
    );

    const ehrUiEnv: Record<string, string> = dotenv.parse(fs.readFileSync(`apps/ehr/env/.env.${environment}`, 'utf8'));

    const intakeUiEnv: Record<string, string> = dotenv.parse(
      fs.readFileSync(`apps/intake/env/.env.${environment}`, 'utf8')
    );

    const { locationId, locationName, locationSlug, virtualLocationState } = await getLocationsForTesting(zambdaEnv);

    let existingEhrConfig: EhrConfig = {};
    let existingIntakeConfig: IntakeConfig = {};

    try {
      existingEhrConfig = JSON.parse(fs.readFileSync(`apps/ehr/env/tests.${environment}.json`, 'utf8')) as EhrConfig;
      console.log('Found existing EHR test config file');
    } catch (error) {
      console.log('No existing EHR test config file found');
      throw error;
    }

    try {
      existingIntakeConfig = JSON.parse(
        fs.readFileSync(`apps/intake/env/tests.${environment}.json`, 'utf8')
      ) as IntakeConfig;
      console.log('Found existing Intake test config file');
    } catch (error) {
      console.log('No existing Intake test config file found');
      throw error;
    }

    let ehrTextUsername = '';
    let ehrTextPassword = '';
    let phoneNumber = '';
    let textUsername = '';
    let textPassword = '';

    if (skipPrompts) {
      // Use existing values when in skip mode
      ehrTextUsername = existingEhrConfig.TEXT_USERNAME || '';
      ehrTextPassword = existingEhrConfig.TEXT_PASSWORD || '';
      phoneNumber = existingIntakeConfig.PHONE_NUMBER || '';
      textUsername = existingIntakeConfig.TEXT_USERNAME || '';
      textPassword = existingIntakeConfig.TEXT_PASSWORD || '';

      console.log('Skipping prompts and using existing values where available');
    } else {
      // Prompt for inputs using the new @inquirer/prompts functions
      ehrTextUsername = await input({
        message: 'Enter EHR test user username:',
        default: existingEhrConfig.TEXT_USERNAME || undefined,
      });

      ehrTextPassword = await password({
        message: 'Enter EHR test user password:',
      });

      // TODO: add to DOC; we receive an SMS with a confirmation code from ClickSend service. TextUsername and TextPassword used to get the sms code from ClickSend service.
      phoneNumber = await input({
        message: 'Enter Intake test user phone number:',
        default: existingIntakeConfig.PHONE_NUMBER || undefined,
      });

      textUsername = await input({
        message: 'Enter ClickSend user username:',
        default: existingIntakeConfig.TEXT_USERNAME || undefined,
      });

      textPassword = await password({
        message: 'Enter ClickSend user password for getting sms auth code:',
      });
    }

    const ehrConfig: EhrConfig = {
      TEXT_USERNAME: ehrTextUsername,
      TEXT_PASSWORD: ehrTextPassword,
      AUTH0_CLIENT: zambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: zambdaEnv.AUTH0_SECRET,
      AUTH0_CLIENT_TESTS: existingEhrConfig.AUTH0_CLIENT_TESTS,
      AUTH0_SECRET_TESTS: existingEhrConfig.AUTH0_SECRET_TESTS,
      LOCATION: locationName,
      LOCATION_ID: locationId,
      WEBSITE_URL: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL,
      FHIR_API: zambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: zambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: zambdaEnv.AUTH0_AUDIENCE,
      PROJECT_API: ehrUiEnv.VITE_APP_PROJECT_API_URL,
      PROJECT_API_ZAMBDA_URL: ehrUiEnv.VITE_APP_PROJECT_API_ZAMBDA_URL,
      CREATE_APPOINTMENT_ZAMBDA_ID: 'create-appointment',
      GET_ANSWER_OPTIONS_ZAMBDA_ID: 'get-answer-options',
      PROJECT_ID: ehrUiEnv.VITE_APP_PROJECT_ID,
      SLUG_ONE: locationSlug,
      STATE_ONE: virtualLocationState,
      EHR_APPLICATION_ID: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_ID,
      ...(environment === 'local' && { APP_IS_LOCAL: 'true' }),
    };

    const intakeConfig: IntakeConfig = {
      PHONE_NUMBER: phoneNumber,
      TEXT_USERNAME: textUsername,
      TEXT_PASSWORD: textPassword,
      SLUG_ONE: locationSlug,
      STATE_ONE: virtualLocationState,
      AUTH0_CLIENT: zambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: zambdaEnv.AUTH0_SECRET,
      AUTH0_CLIENT_TESTS: existingIntakeConfig.AUTH0_CLIENT_TESTS,
      AUTH0_SECRET_TESTS: existingIntakeConfig.AUTH0_SECRET_TESTS,
      LOCATION: locationName,
      LOCATION_ID: locationId,
      WEBSITE_URL: zambdaEnv.WEBSITE_URL,
      FHIR_API: zambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: zambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: zambdaEnv.AUTH0_AUDIENCE,
      PROJECT_API: intakeUiEnv.VITE_APP_PROJECT_API_URL,
    };

    if (Object.values(intakeConfig).some((value) => value === '')) {
      throw new Error('Intake config contains empty values');
    }

    if (Object.values(ehrConfig).some((value) => value === '')) {
      throw new Error('EHR config contains empty values');
    }

    fs.writeFileSync(`apps/ehr/env/tests.${environment}.json`, JSON.stringify(ehrConfig, null, 2));
    fs.writeFileSync(`apps/intake/env/tests.${environment}.json`, JSON.stringify(intakeConfig, null, 2));

    console.log('Env files for tests created successfully');

    if (!ehrConfig.AUTH0_CLIENT_TESTS) {
      console.warn(
        'Missing AUTH0_CLIENT_TESTS env variable that should be set up manually to alter e2e ehr user credentials'
      );
    } else {
      await setTestEhrUserCredentials(ehrConfig);
    }
  } catch (error) {
    console.error('Error: failed to create env files for tests');
    throw error;
  }
}

createTestEnvFiles().catch((error) => {
  console.error(error?.message);
  console.error(error?.stack);
  process.exit(1);
});

const FULL_DAY_SCHEDULE = `{
  "schedule": {
    "monday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "tuesday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "wednesday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "thursday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "friday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "saturday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    },
    "sunday": {
      "open": 0,
      "close": 23,
      "openingBuffer": 0,
      "closingBuffer": 0,
      "workingDay": true,
      "hours": [
        { "hour": 0, "capacity": 200 },
        { "hour": 1, "capacity": 200 },
        { "hour": 2, "capacity": 200 },
        { "hour": 3, "capacity": 200 },
        { "hour": 4, "capacity": 200 },
        { "hour": 5, "capacity": 200 },
        { "hour": 6, "capacity": 200 },
        { "hour": 7, "capacity": 200 },
        { "hour": 8, "capacity": 200 },
        { "hour": 9, "capacity": 200 },
        { "hour": 10, "capacity": 200 },
        { "hour": 11, "capacity": 200 },
        { "hour": 12, "capacity": 200 },
        { "hour": 13, "capacity": 200 },
        { "hour": 14, "capacity": 200 },
        { "hour": 15, "capacity": 200 },
        { "hour": 16, "capacity": 200 },
        { "hour": 17, "capacity": 200 },
        { "hour": 18, "capacity": 200 },
        { "hour": 19, "capacity": 200 },
        { "hour": 20, "capacity": 200 },
        { "hour": 21, "capacity": 200 },
        { "hour": 22, "capacity": 200 },
        { "hour": 23, "capacity": 200 }
      ]
    }
  },
  "scheduleOverrides": {}
}`;

async function ensureOwnerResourceSchedulesAndSlots(
  owner: Location | Practitioner,
  schedules: Schedule[],
  oystehr: Oystehr
): Promise<void> {
  const ownerSchedules = schedules.filter(
    (schedule) => schedule.actor?.[0]?.reference === `${owner.resourceType}/${owner.id}`
  );

  const schedulePostRequests: BatchInputPostRequest<Schedule>[] = [];
  const ownerUpdateRequests: BatchInputPutRequest<Location | Practitioner | Schedule>[] = [];
  const scheduleUpdateRequests: BatchInputPutRequest<Schedule>[] = [];

  if (ownerSchedules.length === 0) {
    schedulePostRequests.push(createScheduleRequest(owner));
  } else {
    ownerSchedules.forEach((schedule) => {
      const extension = schedule.extension ?? [];
      const existingScheduleExtension = extension.find((ext) => ext.url === SCHEDULE_EXTENSION_URL);
      const existingTimezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL);

      if (
        !existingScheduleExtension ||
        existingScheduleExtension.valueString !== FULL_DAY_SCHEDULE ||
        !existingTimezoneExtension
      ) {
        scheduleUpdateRequests.push({
          method: 'PUT',
          url: `/Schedule/${schedule.id}`,
          resource: {
            ...schedule,
            extension: [
              ...extension.filter((ext) => ext.url !== SCHEDULE_EXTENSION_URL && ext.url !== TIMEZONE_EXTENSION_URL),
              { url: SCHEDULE_EXTENSION_URL, valueString: FULL_DAY_SCHEDULE },
              { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
            ],
          },
        });
      }
    });
  }

  const extension = owner.extension ?? [];

  const timezoneExtension = extension.find((ext) => ext.url === TIMEZONE_EXTENSION_URL);

  if (!timezoneExtension) {
    ownerUpdateRequests.push({
      method: 'PUT',
      url: `/${owner.resourceType}/${owner.id}`,
      resource: {
        ...owner,
        extension: [
          ...extension.filter((ext) => ext.url !== TIMEZONE_EXTENSION_URL),
          { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
        ],
      },
    });
  }

  if (schedulePostRequests.length > 0 || ownerUpdateRequests.length > 0 || scheduleUpdateRequests.length > 0) {
    await oystehr.fhir.transaction<FhirResource>({
      requests: [...schedulePostRequests, ...ownerUpdateRequests, ...scheduleUpdateRequests],
    });
    console.log(
      `Updated/created resources for ensuring schedules for owner resource ${owner.resourceType} ${owner.id}}`
    );
  }
}

function createScheduleRequest(owner: Location | Practitioner | Schedule): BatchInputPostRequest<Schedule> {
  const ownerSchedule: Schedule = {
    resourceType: 'Schedule',
    active: true,
    extension: [
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString: FULL_DAY_SCHEDULE,
      },
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
    ],
    actor: [
      {
        reference: `${owner.resourceType}/${owner.id}`,
      },
    ],
  };

  const createScheduleRequest: BatchInputPostRequest<Schedule> = {
    method: 'POST',
    url: '/Schedule',
    resource: ownerSchedule,
  };
  return createScheduleRequest;
}
