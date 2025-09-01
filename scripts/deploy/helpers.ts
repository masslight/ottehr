import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import config from './deploy-config.json';

const projectConfig: any = config;
const environment = projectConfig.environment;

export async function updateOystehr(oystehr: Oystehr, patientPortalUrl: string, ehrUrl: string): Promise<void> {
  console.log('Updating Oystehr applications');
  const applications = await oystehr.application.list();
  const envPatientPortalFile = fs.readFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, 'utf8');
  const applicationPatientPortalClientID = envPatientPortalFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_CLIENT_ID')
    ?.split('=')[1];
  const patientPortalApplication = applications.find(
    (application) => application.clientId === applicationPatientPortalClientID
  );
  if (patientPortalApplication) {
    await oystehr.application.update({
      id: patientPortalApplication.id,
      loginRedirectUri: patientPortalUrl,
      allowedCallbackUrls: [patientPortalUrl, `${patientPortalUrl}/redirect`],
      allowedLogoutUrls: [patientPortalUrl],
      allowedCORSOriginsUrls: [patientPortalUrl],
      allowedWebOriginsUrls: [patientPortalUrl],
    });
    console.log('Updated patient portal application');
  }

  const envEHRFile = fs.readFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, 'utf8');
  const applicationEHRClientID = envEHRFile
    .split('\n')
    .find((item) => item.split('=')[0] === 'VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID')
    ?.split('=')[1];
  const ehrApplication = applications.find((application: any) => application.clientId === applicationEHRClientID);
  if (ehrApplication) {
    await oystehr.application.update({
      id: ehrApplication.id,
      loginRedirectUri: ehrUrl,
      allowedCallbackUrls: [ehrUrl],
      allowedLogoutUrls: [ehrUrl],
      allowedCORSOriginsUrls: [ehrUrl],
      allowedWebOriginsUrls: [ehrUrl],
    });
    console.log('Updated EHR application');
  }
}

export async function updateEnvFiles(environment: string, patientPortalUrl: string, ehrUrl: string): Promise<void> {
  console.log('Updating website env files');
  let patientPortalEnvFile = fs.readFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, 'utf8');
  patientPortalEnvFile = patientPortalEnvFile.replace(/paperwork\//g, '');
  patientPortalEnvFile = patientPortalEnvFile.replace(
    'http://localhost:3000/local',
    'https://project-api.zapehr.com/v1'
  );
  patientPortalEnvFile = patientPortalEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');

  let ehrEnvFile = fs.readFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, 'utf8');
  ehrEnvFile = ehrEnvFile.replace('http://localhost:3000/local', 'https://project-api.zapehr.com/v1');
  ehrEnvFile = ehrEnvFile.replace('http://localhost:4000/local', 'https://project-api.zapehr.com/v1');
  ehrEnvFile = ehrEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  ehrEnvFile = ehrEnvFile.replace(
    'VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL=http://localhost:4002',
    `VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL=${ehrUrl}`
  );
  ehrEnvFile = ehrEnvFile.replace(
    'VITE_APP_PATIENT_APP_URL=http://localhost:3002',
    `VITE_APP_PATIENT_APP_URL=${patientPortalUrl}`
  );

  fs.writeFileSync(`${__dirname}/../../apps/intake/env/.env.${environment}`, patientPortalEnvFile);
  fs.writeFileSync(`${__dirname}/../../apps/ehr/env/.env.${environment}`, ehrEnvFile);
}

export async function getM2MClientAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (!clientId) {
    throw new Error('Missing client_id');
  }
  if (!clientSecret) {
    throw new Error('Missing client_secret');
  }
  try {
    console.log('Fetching auth0 token...');
    const response = await fetch('https://auth.zapehr.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience: 'https://api.zapehr.com',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Got auth0 token');
    return (await response.json()).access_token;
  } catch (error: any) {
    console.error('❌ Failed to get auth0 token', error);
    throw new Error(error.message);
  }
}
