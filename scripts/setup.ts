import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { setupEHR } from '../packages/ehr/zambdas/scripts/setup';
import { setupIntake } from '../packages/urgent-care/zambdas/scripts/setup';

const projectApiUrl = 'https://project-api.zapehr.com/v1';

async function getUserInput(): Promise<{ accessToken: string; projectId: string; providerEmail: string }> {
  const { accessToken, projectId, providerEmail } = await inquirer.prompt([
    {
      message: 'Please enter your access token:',
      name: 'accessToken',
      type: 'input',
      validate: (input: any) => !!input || 'Access token is required',
    },
    {
      message: 'Please enter your project id:',
      name: 'projectId',
      type: 'input',
      validate: (input: any) => !!input || 'Project id is required',
    },
    {
      message: 'Please enter the email of your first provider:',
      name: 'providerEmail',
      type: 'input',
      validate: (input: any) => !!input || 'Provider email is required',
    },
  ]);
  return { accessToken, projectId, providerEmail };
}

async function createM2M(accessToken: string, projectId: string): Promise<[string, string, string]> {
  return new Promise((resolve, reject) => {
    fetch(`${projectApiUrl}/m2m`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': `${projectId}`,
      },
      method: 'POST',
      body: JSON.stringify({
        name: 'Example M2M Client',
        description: 'This M2M Client is used for initial Ottehr setup.',
        accessPolicy: {
          rule: [
            {
              resource: ['FHIR:*'],
              action: ['FHIR:*'],
              effect: 'Allow',
            },
            {
              resource: ['Telemed:*'],
              action: ['Telemed:*'],
              effect: 'Allow',
            },
            {
              resource: ['App:User'],
              action: ['App:CreateUser'],
              effect: 'Allow',
            },
            {
              resource: ['Zambda:*'],
              action: ['Zambda:*'],
              effect: 'Allow',
            },
            {
              resource: ['IAM:M2MClient:*'],
              action: ['IAM:ListAllM2MClients', 'IAM:GetM2MClient'],
              effect: 'Allow',
            },
            {
              resource: [`Z3:${projectId}-id-cards/*`, `Z3:${projectId}-insurance-cards/*`],
              action: ['Z3:PutObject', 'Z3:GetObject'],
              effect: 'Allow',
            },
          ],
        },
      }),
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          console.error('response', response);
          throw new Error(`Failed to create M2M client. Status: ${response.status}`);
        }
      })
      .then((data) => {
        const m2mId = data.id;
        const m2mClientId = data.clientId;
        const m2mDeviceId = data.profile.replace('Device/', '');

        fetch(`${projectApiUrl}/m2m/${m2mId}/rotate-secret`, {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${accessToken}`,
            'x-zapehr-project-id': `${projectId}`,
          },
          method: 'POST',
        })
          .then((response) => {
            if (response.status === 200) {
              return response.json();
            } else {
              throw new Error(`Failed to rotate M2M secret. Status: ${response.status}`);
            }
          })
          .then((secretData) => {
            const m2mSecret = secretData.secret;
            resolve([m2mDeviceId, m2mClientId, m2mSecret]);
          })
          .catch((error) => reject(error));
      })
      .catch((error) => reject(error));
  });
}

async function runCLI(): Promise<void> {
  const { accessToken, projectId, providerEmail } = await getUserInput();

  console.log('Starting setup...');

  const [m2mDeviceId, m2mClientId, m2mSecret] = await createM2M(accessToken, projectId);
  console.log('Created m2m:', m2mClientId, m2mSecret);

  try {
    await setupEHR(projectApiUrl, accessToken, projectId, providerEmail, m2mDeviceId, m2mClientId, m2mSecret);
    await setupIntake(projectApiUrl, accessToken, projectId, providerEmail, m2mDeviceId, m2mClientId, m2mSecret);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

runCLI().catch(() => process.exit(1));
