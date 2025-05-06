import { input, password } from '@inquirer/prompts';
import Oystehr from '@oystehr/sdk';
import dotenv from 'dotenv';
import { Location, Practitioner } from 'fhir/r4b';
import fs from 'fs';
import { allLicensesForPractitioner, makeQualificationForPractitioner } from 'utils';
import { isLocationVirtual } from 'utils/lib/fhir/location';
import { allPhysicalDefaultLocations } from '../packages/zambdas/src/scripts/setup-default-locations';

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

  const locationsResponse = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
  });

  const locations = locationsResponse.unbundle();

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

  const virtualLocation = virtualLocations.at(0);
  const locationState = (virtualLocation?.address?.state || '').toLowerCase();

  if (!locationId) {
    throw Error('Required locationId not found  ');
  }

  if (!locationName) {
    throw Error('Required locationName not found');
  }

  if (!locationSlug) {
    throw Error('Required locationSlug not found');
  }

  if (!locationState) {
    throw Error('Required locationState not found');
  }

  console.log(`Found location by name '${locationResource.name}' with ID: ${locationId}`);
  console.log(`Location name: ${locationName}, slug: ${locationSlug}`);

  console.log(`Found virtual location with ID: ${virtualLocation?.id}`);
  console.log(`Location name: ${virtualLocation?.name}, state: ${virtualLocation?.address?.state}`);

  return {
    locationId,
    locationName,
    locationSlug,
    virtualLocationState: locationState,
  };
}

async function setTestEhrUserCredentials(ehrConfig: EhrConfig): Promise<void> {
  console.log(`Setting up test EHR provider credentials`);
  console.log(ehrConfig);
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

  const firstVirtualLocation = virtualLocations.at(0);
  const licenses = allLicensesForPractitioner(practitioner);
  const qualification = practitioner.qualification || [];
  if (!licenses.find((license) => license.state === firstVirtualLocation?.address?.state)) {
    qualification.push(
      makeQualificationForPractitioner({
        state: firstVirtualLocation?.address?.state || '',
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
    } catch {
      console.log('No existing EHR test config file found');
    }

    try {
      existingIntakeConfig = JSON.parse(
        fs.readFileSync(`apps/intake/env/tests.${environment}.json`, 'utf8')
      ) as IntakeConfig;
      console.log('Found existing Intake test config file');
    } catch {
      console.log('No existing Intake test config file found');
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
      CREATE_APPOINTMENT_ZAMBDA_ID: ehrUiEnv.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID,
      GET_ANSWER_OPTIONS_ZAMBDA_ID: intakeUiEnv.VITE_APP_GET_ANSWER_OPTIONS_ZAMBDA_ID,
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
  } catch (e) {
    console.error('Error creating env files for tests', e, JSON.stringify(e));
  }
}

createTestEnvFiles().catch(() => process.exit(1));
