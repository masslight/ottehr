import { input, password } from '@inquirer/prompts';
import Oystehr from '@oystehr/sdk';
import dotenv from 'dotenv';
import { Location, Practitioner } from 'fhir/r4b';
import fs from 'fs';
import { allLicensesForPractitioner, makeQualificationForPractitioner } from 'utils';
import { isLocationVirtual } from 'utils/lib/fhir/location';

const getEnvironment = (): string => {
  const envFlagIndex = process.argv.findIndex((arg) => arg === '--environment');
  if (envFlagIndex !== -1 && envFlagIndex < process.argv.length - 1) {
    const env = process.argv[envFlagIndex + 1];
    const validEnvironments = ['local', 'demo', 'development', 'staging', 'testing', 'e2e', 'e2e2', 'e2e3'];
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

  const licenses = allLicensesForPractitioner(practitioner);
  const qualification = practitioner.qualification || [];
  if (!licenses.find((license) => license.state === 'CA')) {
    qualification.push(
      makeQualificationForPractitioner({
        state: 'CA',
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
      WEBSITE_URL: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL,
      FHIR_API: zambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: zambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: zambdaEnv.AUTH0_AUDIENCE,
      PROJECT_API: ehrUiEnv.VITE_APP_PROJECT_API_URL,
      PROJECT_API_ZAMBDA_URL: ehrUiEnv.VITE_APP_PROJECT_API_ZAMBDA_URL,
      CREATE_APPOINTMENT_ZAMBDA_ID: 'create-appointment',
      GET_ANSWER_OPTIONS_ZAMBDA_ID: 'get-answer-options',
      PROJECT_ID: ehrUiEnv.VITE_APP_PROJECT_ID,
      EHR_APPLICATION_ID: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_ID,
      ...(environment === 'local' && { APP_IS_LOCAL: 'true' }),
    };

    const intakeConfig: IntakeConfig = {
      PHONE_NUMBER: phoneNumber,
      TEXT_USERNAME: textUsername,
      TEXT_PASSWORD: textPassword,
      AUTH0_CLIENT: zambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: zambdaEnv.AUTH0_SECRET,
      AUTH0_CLIENT_TESTS: existingIntakeConfig.AUTH0_CLIENT_TESTS,
      AUTH0_SECRET_TESTS: existingIntakeConfig.AUTH0_SECRET_TESTS,
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
