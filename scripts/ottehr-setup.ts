import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { setupEHR } from '../packages/ehr/zambdas/scripts/setup';
import { setupIntake } from '../packages/intake/zambdas/scripts/setup-intake';

const projectApiUrl = 'https://project-api.zapehr.com/v1';

async function getUserInput(): Promise<{
  accessToken: string;
  projectId: string;
  providerEmail: string;
}> {
  if (process.argv.length > 2) {
    return { projectId: process.argv[2], accessToken: process.argv[3], providerEmail: process.argv[4] };
  }
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

async function createM2M(
  accessToken: string,
  projectId: string
): Promise<{ deviceId: string; clientId: string; secret: string }> {
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
              action: ['App:CreateUser', 'App:GetUser', 'App:UpdateUser', 'App:ListAllUsers'],
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
              resource: ['IAM:Role'],
              action: ['IAM:GetRole', 'IAM:ListAllRoles', 'IAM:CreateRole', 'IAM:UpdateRole'],
              effect: 'Allow',
            },
            {
              resource: [
                `Z3:${projectId}-photo-id-cards/*`,
                `Z3:${projectId}-insurance-cards/*`,
                `Z3:${projectId}-school-work-note-templates/*`,
                `Z3:${projectId}-patient-photos/*`,
                `Z3:${projectId}-consent-forms/*`,
                `Z3:${projectId}-visit-notes/*`,
                `Z3:${projectId}-receipts/*`,
                `Z3:${projectId}-school-work-notes/*`,
              ],
              action: ['Z3:PutObject', 'Z3:GetObject'],
              effect: 'Allow',
            },
            {
              action: ['Messaging:SendTransactionalSMS'],
              effect: 'Allow',
              resource: ['*'],
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
            resolve({ deviceId: m2mDeviceId, clientId: m2mClientId, secret: m2mSecret });
          })
          .catch((error) => reject(error));
      })
      .catch((error) => reject(error));
  });
}

async function runCLI(): Promise<void> {
  const { accessToken, projectId, providerEmail } = await getUserInput();
  let environment = 'local';
  if (process.argv.length >= 6) {
    environment = process.argv[5];
  }

  console.log('Starting setup...');

  const { clientId: m2mClientId, secret: m2mSecret } = await createM2M(accessToken, projectId);
  console.log('Created m2m:', m2mClientId);

  try {
    await setupEHR(projectApiUrl, accessToken, projectId, providerEmail, m2mClientId, m2mSecret, environment);
    await setupIntake(projectApiUrl, accessToken, projectId, m2mClientId, m2mSecret, environment);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

runCLI().catch(() => process.exit(1));
