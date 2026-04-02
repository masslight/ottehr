import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import * as fs from 'fs';
import { fhirApiUrlFromAuth0Audience, projectApiUrlFromAuth0Audience } from '../packages/zambdas/src/scripts/helpers';
import { getAuth0Token } from '../packages/zambdas/src/shared';

async function main(): Promise<void> {
  const env = process.argv[2];

  const envFilePath = `../packages/zambdas/.env/${env}.json`;
  const secrets = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
    projectApiUrl: projectApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // get organization
  const organizationName = `${secrets['project-name']} Organization`;
  const organizationSearch = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [{ name: 'name', value: organizationName }],
  });
  const organization = (await organizationSearch.unbundle())[0];

  if (!organization) {
    throw new Error(`Organization ${organizationName} not found`);
  } else {
    secrets['ORGANIZATION_ID'] = organization.id;
    fs.writeFileSync(envFilePath, JSON.stringify(secrets, null, 2));
    console.log(`Updated ORGANIZATION_ID=${organization.id} in ${envFilePath}`);
  }

  // get default billing resource
  const defaultBillingResourceSearch = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [{ name: 'name', value: 'Default Billing Provider' }],
  });
  const defaultBillingResource = (await defaultBillingResourceSearch.unbundle())[0];
  if (!defaultBillingResource) {
    throw new Error('Default billing resource not found');
  } else {
    secrets['DEFAULT_BILLING_RESOURCE'] = `${defaultBillingResource.resourceType}/${defaultBillingResource.id}`;
    fs.writeFileSync(envFilePath, JSON.stringify(secrets, null, 2));
    console.log(
      `Updated DEFAULT_BILLING_RESOURCE=${defaultBillingResource.resourceType}/${defaultBillingResource.id} in ${envFilePath}`
    );
  }

  // get sendgrid api key
  const sendgridApiKey = secrets['SENDGRID_API_KEY'];
  if (!sendgridApiKey) {
    throw new Error('Sendgrid API key not found');
  }

  const m2ms = await oystehr.m2m.list();
  const e2eM2M = m2ms.find((m2m) => m2m.name === 'E2E Tests M2M Client');
  if (!e2eM2M) {
    throw new Error('E2E Tests M2M Client not found');
  }
  const rotateResponse = await oystehr.m2m.rotateSecret({ id: e2eM2M.id });
  secrets['AUTH0_CLIENT_TESTS'] = e2eM2M.clientId;
  secrets['AUTH0_SECRET_TESTS'] = rotateResponse.secret!;
  fs.writeFileSync(envFilePath, JSON.stringify(secrets, null, 2));
  console.log(`Updated AUTH0_CLIENT_TESTS (${e2eM2M.clientId}) and AUTH0_SECRET_TESTS in ${envFilePath}`);

  // create test environment files for apps with E2E M2M credentials
  const appsToUpdate = ['ehr', 'intake'];
  const testEnvData = {
    AUTH0_CLIENT_TESTS: secrets['AUTH0_CLIENT_TESTS'],
    AUTH0_SECRET_TESTS: secrets['AUTH0_SECRET_TESTS'],
    TEXT_USERNAME: 'e2euser@masslight.com',
    TEXT_PASSWORD: '',
  };

  const testEnvDataIntake = {
    ...testEnvData,
    PHONE_NUMBER: '',
    TEXT_USERNAME: '',
    TEXT_PASSWORD: '',
  };

  for (const app of appsToUpdate) {
    const appTestEnvPath = `../apps/${app}/env/tests.${env}.json`;

    // only create file if it doesn't exist
    if (fs.existsSync(appTestEnvPath)) {
      console.log(`Updating existing ${appTestEnvPath} with E2E M2M credentials`);
    }
    if (app === 'ehr') {
      fs.writeFileSync(appTestEnvPath, JSON.stringify(testEnvData, null, 2));
    } else {
      fs.writeFileSync(appTestEnvPath, JSON.stringify(testEnvDataIntake, null, 2));
    }
    console.log(`Created ${appTestEnvPath} with E2E M2M credentials`);
  }
}

main()
  .then(() => console.log('Completed filling env with created resources data'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
