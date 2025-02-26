import fs from 'fs';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { defaultLocation } from 'utils';

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

export async function createTestEnvFiles(): Promise<void> {
  try {
    // Check if we should skip prompts
    const skipPrompts = process.argv.includes('--skip-prompts');

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

    // Try to read existing test config files
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
      // Prompt for inputs
      const ehrPromptResult = await inquirer.prompt([
        {
          type: 'input',
          name: 'ehrTextUsername',
          message: 'Enter EHR test user username:',
          default: existingEhrConfig.TEXT_USERNAME || undefined,
        },
        {
          type: 'input',
          name: 'ehrTextPassword',
          message: 'Enter EHR test user password:',
          default: existingEhrConfig.TEXT_PASSWORD || undefined,
        },
      ]);

      ehrTextUsername = ehrPromptResult.ehrTextUsername;
      ehrTextPassword = ehrPromptResult.ehrTextPassword;

      // TODO: add to DOC; we receive an SMS with a confirmation code from ClickSend service. TextUsername and TextPassword used to get the sms code from ClickSend service.
      const intakePromptResult = await inquirer.prompt([
        {
          type: 'input',
          name: 'phoneNumber',
          message: 'Enter Intake test user phone number:',
          default: existingIntakeConfig.PHONE_NUMBER || undefined,
        },
        {
          type: 'input',
          name: 'textUsername',
          message: 'Enter ClickSend user username:',
          default: existingIntakeConfig.TEXT_USERNAME || undefined,
        },
        {
          type: 'input',
          name: 'textPassword',
          message: 'Enter ClickSend user password for getting sms auth code:',
          default: existingIntakeConfig.TEXT_PASSWORD || undefined,
        },
      ]);

      phoneNumber = intakePromptResult.phoneNumber;
      textUsername = intakePromptResult.textUsername;
      textPassword = intakePromptResult.textPassword;
    }

    const ehrConfig: EhrConfig = {
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

    const intakeConfig: IntakeConfig = {
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

    // If skipping prompts, preserve existing values for user-input fields
    if (skipPrompts) {
      // Only write files if we have all required values
      if (ehrConfig.TEXT_USERNAME && ehrConfig.TEXT_PASSWORD) {
        fs.writeFileSync('apps/ehr/env/tests.local.json', JSON.stringify(ehrConfig, null, 2));
        console.log('EHR test config file updated');
      } else {
        console.warn('Skipping EHR config file write - missing required values');
      }

      if (intakeConfig.PHONE_NUMBER && intakeConfig.TEXT_USERNAME && intakeConfig.TEXT_PASSWORD) {
        fs.writeFileSync('apps/intake/env/tests.local.json', JSON.stringify(intakeConfig, null, 2));
        console.log('Intake test config file updated');
      } else {
        console.warn('Skipping Intake config file write - missing required values');
      }
    } else {
      // Always write files when not skipping prompts
      fs.writeFileSync('apps/ehr/env/tests.local.json', JSON.stringify(ehrConfig, null, 2));
      fs.writeFileSync('apps/intake/env/tests.local.json', JSON.stringify(intakeConfig, null, 2));
      console.log('Env files for tests created successfully');
    }
  } catch (e) {
    console.error('Error creating env files for tests', e);
  }
}

createTestEnvFiles().catch(() => process.exit(1));
