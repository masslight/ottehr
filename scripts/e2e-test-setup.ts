import fs from 'fs';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { defaultLocation } from 'utils';

export async function createTestEnvFiles(): Promise<void> {
  try {
    const ehrZambdaEnv: Record<string, string> = JSON.parse(
      fs.readFileSync('packages/ehr/zambdas/.env/local.json', 'utf8')
    );

    const ehrUiEnv: Record<string, string> = dotenv.parse(fs.readFileSync('apps/ehr/env/.env.local', 'utf8'));

    const intakeZambdaEnv: Record<string, string> = JSON.parse(
      fs.readFileSync('packages/intake/zambdas/.env/local.json', 'utf8')
    );

    const intakeUiEnv: Record<string, string> = dotenv.parse(fs.readFileSync('apps/intake/env/.env.local', 'utf8'));

    let ehrTemplateEnv = {};
    let intakeTemplateEnv = {};

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

    const { ehrTextUsername, ehrTextPassword } = await inquirer.prompt([
      {
        type: 'input',
        name: 'ehrTextUsername',
        message: 'Enter EHR test user username:',
      },
      {
        type: 'input',
        name: 'ehrTextPassword',
        message: 'Enter EHR test user password for getting sms auth code:',
      },
    ]);

    // TODO: add to DOC; we receive an SMS with a confirmation code from ClickSend service. TextUsername and TextPassword used to get the sms code from ClickSend service.
    const { phoneNumber, textUsername, textPassword } = await inquirer.prompt([
      {
        type: 'input',
        name: 'phoneNumber',
        message: 'Enter Intake test user phone number:',
      },
      {
        type: 'input',
        name: 'textUsername',
        message: 'Enter ClickSend user username:',
      },
      {
        type: 'input',
        name: 'textPassword',
        message: 'Enter ClickSend user password for getting sms auth code:',
      },
    ]);

    const ehrConfig = {
      TEXT_USERNAME: ehrTextUsername,
      TEXT_PASSWORD: ehrTextPassword,
      AUTH0_CLIENT: ehrZambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: ehrZambdaEnv.AUTH0_SECRET,
      LOCATION: defaultLocation.name,
      LOCATION_ID: defaultLocation.id,
      WEBSITE_URL: ehrUiEnv.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL,
      FHIR_API: ehrZambdaEnv.FHIR_API,
      AUTH0_ENDPOINT: ehrZambdaEnv.AUTH0_ENDPOINT,
      AUTH0_AUDIENCE: ehrZambdaEnv.AUTH0_AUDIENCE,
      ...ehrTemplateEnv,
    };

    const intakeConfig = {
      PHONE_NUMBER: phoneNumber,
      TEXT_USERNAME: textUsername,
      TEXT_PASSWORD: textPassword,
      SLUG_ONE: defaultLocation.identifier?.[0]?.value ?? '',
      STATE_ONE: defaultLocation.address?.state ?? '',
      AUTH0_CLIENT: intakeZambdaEnv.AUTH0_CLIENT,
      AUTH0_SECRET: intakeZambdaEnv.AUTH0_SECRET,
      LOCATION: defaultLocation.name,
      LOCATION_ID: defaultLocation.id,
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
