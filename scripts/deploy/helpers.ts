import fetch from 'node-fetch';
import fs from 'fs';
import config from './deploy-config.json';
import path from 'path';

const projectConfig: any = config;
const environment = projectConfig.environment;
const projectID = projectConfig.project_id;
const accessToken = projectConfig.access_token;

export async function updateZapehr(intakeDistribution: string, ehrDistribution: string): Promise<void> {
  const applicationsRequest = await fetch('https://project-api.zapehr.com/v1/application', {
    headers: {
      'x-zapehr-project-id': projectID,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const applications = await applicationsRequest.json();
  const envIntakeFile = fs.readFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, 'utf8');
  const applicationIntakeClientID = envIntakeFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_CLIENT_ID')
    ?.split('=')[1];
  const applicationIntakeID = applications.find(
    (application: any) => application.clientId === applicationIntakeClientID
  ).id;
  const envEHRFile = fs.readFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, 'utf8');
  const applicationEHRClientID = envEHRFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID')
    ?.split('=')[1];
  const applicationEHRID = applications.find((application: any) => application.clientId === applicationEHRClientID).id;

  const updateIntakeApplicationRequest = await fetch(
    `https://project-api.zapehr.com/v1/application/${applicationIntakeID}`,
    {
      method: 'PATCH',
      headers: {
        'x-zapehr-project-id': projectID,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        loginRedirectUri: intakeDistribution,
        allowedCallbackUrls: [intakeDistribution, `${intakeDistribution}/redirect`],
        allowedLogoutUrls: [intakeDistribution],
        allowedCORSOriginsUrls: [intakeDistribution],
        allowedWebOriginsUrls: [intakeDistribution],
      }),
    }
  );
  const updateEHRApplicationRequest = await fetch(`https://project-api.zapehr.com/v1/application/${applicationEHRID}`, {
    method: 'PATCH',
    headers: {
      'x-zapehr-project-id': projectID,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      loginRedirectUri: ehrDistribution,
      allowedCallbackUrls: [ehrDistribution],
      allowedLogoutUrls: [ehrDistribution],
      allowedCORSOriginsUrls: [ehrDistribution],
      allowedWebOriginsUrls: [ehrDistribution],
    }),
  });
  console.log(await updateIntakeApplicationRequest.json());
  console.log(await updateEHRApplicationRequest.json());
}

export async function updateZambdas(
  environment: string,
  intakeDistribution: string,
  ehrDistribution: string
): Promise<void> {
  console.log(__dirname);
  let intakeEnvFile = fs.readFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, 'utf8');
  intakeEnvFile = intakeEnvFile.replace(/paperwork\//g, '');
  intakeEnvFile = intakeEnvFile.replace('http://localhost:3000/local', 'https://project-api.zapehr.com/v1');
  intakeEnvFile = intakeEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');

  let ehrEnvFile = fs.readFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, 'utf8');
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

  fs.writeFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, intakeEnvFile);
  fs.writeFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, ehrEnvFile);
}
