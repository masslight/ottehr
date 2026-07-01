import * as fs from 'fs';
import * as path from 'path';

const env = process.env.ENV || 'local';
const envFilePath = path.resolve(__dirname, '../../../../config/.env', `${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

export const SECRETS = {
  FHIR_API: envConfig.FHIR_API,
  AUTH0_ENDPOINT: envConfig.AUTH0_ENDPOINT,
  AUTH0_AUDIENCE: envConfig.AUTH0_AUDIENCE,
  AUTH0_CLIENT_TESTS: envConfig.AUTH0_CLIENT_TESTS,
  AUTH0_SECRET_TESTS: envConfig.AUTH0_SECRET_TESTS,
  PROJECT_API: envConfig.PROJECT_API,
  PROJECT_ID: envConfig.PROJECT_ID,
  // Webhook secret AdvaPACS would sign its callbacks with; used by the
  // radiology-pacs-webhook integration test to satisfy the endpoint's access check.
  ADVAPACS_WEBHOOK_SECRET: envConfig.ADVAPACS_WEBHOOK_SECRET,
};
