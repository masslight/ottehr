import fs from 'fs';
import config from './deploy-config.json';
import Oystehr from '@oystehr/sdk';

const projectConfig: any = config;
const environment = projectConfig.environment;
const accessToken = projectConfig.access_token;

export async function updateZapehr(intakeDistribution: string, ehrDistribution: string): Promise<void> {
  const oystehr = new Oystehr({
    accessToken: accessToken,
  });
  const applications = await oystehr.application.list();
  const envIntakeFile = fs.readFileSync(`../../apps/intake/env/.env.${environment}`, 'utf8');
  const applicationIntakeClientID = envIntakeFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_CLIENT_ID')
    ?.split('=')[1];
  const applicationIntakeID = applications.find(
    (application: any) => application.clientId === applicationIntakeClientID
  )?.id;
  const envEHRFile = fs.readFileSync(`../../apps/ehr/env/.env.${environment}`, 'utf8');
  const applicationEHRClientID = envEHRFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID')
    ?.split('=')[1];
  const applicationEHRID = applications.find((application: any) => application.clientId === applicationEHRClientID)?.id;

  if (!applicationIntakeID || !applicationEHRID) {
    console.log('application ID not found');
    console.log(applicationIntakeID);
    console.log(applicationEHRID);
    process.exit();
  }

  const updateIntakeApplicationRequest = await oystehr.application.update({
    id: applicationIntakeID,
    loginRedirectUri: intakeDistribution,
    allowedCallbackUrls: [intakeDistribution, `${intakeDistribution}/redirect`],
    allowedLogoutUrls: [intakeDistribution],
    allowedCORSOriginsUrls: [intakeDistribution],
    allowedWebOriginsUrls: [intakeDistribution],
  });

  const updateEHRApplicationRequest = await oystehr.application.update({
    id: applicationEHRID,
    loginRedirectUri: ehrDistribution,
    allowedCallbackUrls: [ehrDistribution],
    allowedLogoutUrls: [ehrDistribution],
    allowedCORSOriginsUrls: [ehrDistribution],
    allowedWebOriginsUrls: [ehrDistribution],
  });

  console.log(updateIntakeApplicationRequest);
  console.log(updateEHRApplicationRequest);
}

export async function updateZambdas(
  environment: string,
  intakeDistribution: string,
  ehrDistribution: string
): Promise<void> {
  let intakeEnvFile = fs.readFileSync(`../../apps/intake/env/.env.${environment}`, 'utf8');
  intakeEnvFile = intakeEnvFile.replace(/paperwork\//g, '');
  intakeEnvFile = intakeEnvFile.replace('http://localhost:3000/local', 'https://project-api.zapehr.com/v1');
  intakeEnvFile = intakeEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');

  let ehrEnvFile = fs.readFileSync(`../../apps/ehr/env/.env.${environment}`, 'utf8');
  ehrEnvFile = ehrEnvFile.replace('http://localhost:3000/local', 'https://project-api.zapehr.com/v1');
  ehrEnvFile = ehrEnvFile.replace('http://localhost:4000/local', 'https://project-api.zapehr.com/v1');
  ehrEnvFile = ehrEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');

  if (ehrDistribution) {
    ehrEnvFile = ehrEnvFile.replace(
      'VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL=http://localhost:4002',
      `VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL=${ehrDistribution}`
    );
  }
  if (intakeDistribution) {
    ehrEnvFile = ehrEnvFile.replace('VITE_APP_QRS_URL=http://localhost:3002', `VITE_APP_QRS_URL=${intakeDistribution}`);
  }

  fs.writeFileSync(`../../apps/intake/env/.env.${environment}`, intakeEnvFile);
  fs.writeFileSync(`../../apps/ehr/env/.env.${environment}`, ehrEnvFile);
}
