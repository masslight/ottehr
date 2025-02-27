import fs from 'fs';
import { input, password } from '@inquirer/prompts';
import dotenv from 'dotenv';
import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { DEFAULT_TESTING_SLUG } from '../packages/intake/zambdas/scripts/setup-default-locations';

interface EhrConfig {
  TEXT_USERNAME?: string;
  TEXT_PASSWORD?: string;
  AUTH0_CLIENT?: string;
  AUTH0_SECRET?: string;
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

async function getLocationForTesting(
  ehrZambdaEnv: Record<string, string>
): Promise<{ locationId: string; locationName: string; locationSlug: string; locationState: string }> {
  const tokenResponse = await fetch(ehrZambdaEnv.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: ehrZambdaEnv.AUTH0_CLIENT,
      client_secret: ehrZambdaEnv.AUTH0_SECRET,
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

  const testingResponse = await oystehr.fhir.search<Location>({
    resourceType: 'Location',
    params: [
      {
        name: 'identifier',
        value: `https://fhir.ottehr.com/r4/slug|${DEFAULT_TESTING_SLUG}`,
      },
    ],
  });

  if (testingResponse.entry && testingResponse.entry.length > 0) {
    const locationResource = testingResponse.entry[0].resource;

    const locationId = locationResource?.id;
    const locationName = locationResource?.name;
    const locationSlug = locationResource?.identifier?.[0]?.value;
    const locationState = (locationResource?.address?.state || '').toLowerCase();

    if (!locationId || !locationName || !locationSlug || !locationState) {
      throw Error('Required location properties not found');
    }

    console.log(`Found location by slug '${DEFAULT_TESTING_SLUG}' with ID: ${locationId}`);
    console.log(`Location name: ${locationName}, slug: ${locationSlug}, state: ${locationState}`);

    return {
      locationId,
      locationName,
      locationSlug,
      locationState,
    };
  }

  throw Error('No locations found in FHIR API');
}

export async function createTestEnvFiles(): Promise<void> {
  try {
    const skipPrompts = process.argv.includes('--skip-prompts');

    const ehrZambdaEnv: Record<string, string> = JSON.parse(
      fs.readFileSync('packages/ehr/zambdas/.env/local.json', 'utf8')
    );

    const ehrUiEnv: Record<string, string> = dotenv.parse(fs.readFileSync('apps/ehr/env/.env.local', 'utf8'));

    const intakeZambdaEnv: Record<string, string> = JSON.parse(
      fs.readFileSync('packages/intake/zambdas/.env/local.json', 'utf8')
    );

    const intakeUiEnv: Record<string, string> = dotenv.parse(fs.readFileSync('apps/intake/env/.env.local', 'utf8'));

    const { locationId, locationName, locationSlug, locationState } = await getLocationForTesting(ehrZambdaEnv);

    let ehrTemplateEnv = {};
    let intakeTemplateEnv = {};

    let existingEhrConfig: EhrConfig = {};
    let existingIntakeConfig: IntakeConfig = {};

    const isValueExists = (value: unknown): boolean => value !== undefined && value !== '';

    try {
      ehrTemplateEnv = Object.fromEntries(
        Object.entries(JSON.parse(fs.readFileSync('apps/ehr/env/tests.local-template.json', 'utf8'))).filter(
          ([_, value]) => isValueExists(value)
        )
      );
    } catch {
      console.warn('No existing EHR test template env file found (apps/ehr/env/tests.local-template.json)');
    }

    try {
      intakeTemplateEnv = Object.fromEntries(
        Object.entries(JSON.parse(fs.readFileSync('apps/intake/env/tests.local-template.json', 'utf8'))).filter(
          ([_, value]) => isValueExists(value)
        )
      );
    } catch {
      console.warn('No existing Intake test template env file found (apps/intake/env/tests.local-template.json)');
    }

    try {
      existingEhrConfig = JSON.parse(fs.readFileSync('apps/ehr/env/tests.local.json', 'utf8')) as EhrConfig;
      console.log('Found existing EHR test config file');
    } catch {
      console.log('No existing EHR test config file found');
    }

    try {
      existingIntakeConfig = JSON.parse(fs.readFileSync('apps/intake/env/tests.local.json', 'utf8')) as IntakeConfig;
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
      AUTH0_CLIENT: ehrZambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: ehrZambdaEnv.AUTH0_SECRET,
      LOCATION: locationName,
      LOCATION_ID: locationId,
      WEBSITE_URL: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL,
      FHIR_API: ehrZambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: ehrZambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: ehrZambdaEnv.AUTH0_AUDIENCE,
      ...ehrTemplateEnv,
    };

    const intakeConfig: IntakeConfig = {
      PHONE_NUMBER: phoneNumber,
      TEXT_USERNAME: textUsername,
      TEXT_PASSWORD: textPassword,
      SLUG_ONE: locationSlug,
      STATE_ONE: locationState,
      AUTH0_CLIENT: intakeZambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: intakeZambdaEnv.AUTH0_SECRET,
      LOCATION: locationName,
      LOCATION_ID: locationId,
      WEBSITE_URL: intakeZambdaEnv.WEBSITE_URL,
      FHIR_API: intakeZambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: intakeZambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: intakeZambdaEnv.AUTH0_AUDIENCE,
      PROJECT_API: intakeUiEnv.VITE_APP_PROJECT_API_URL,
      ...intakeTemplateEnv,
    };

    fs.writeFileSync('apps/ehr/env/tests.local.json', JSON.stringify(ehrConfig, null, 2));
    fs.writeFileSync('apps/intake/env/tests.local.json', JSON.stringify(intakeConfig, null, 2));

    console.log('Env files for tests created successfully');
  } catch (e) {
    console.error('Error creating env files for tests', e);
  }
}

createTestEnvFiles().catch(() => process.exit(1));
