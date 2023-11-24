/* eslint-disable sort-keys */
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function getUserInput(): Promise<{ accessToken: string; projectId: string }> {
  const { accessToken, projectId } = await inquirer.prompt([
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
  ]);
  return { accessToken, projectId };
}

function createApplication(accessToken: string, projectId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch('https://project-api.zapehr.com/v1/application', {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': `${projectId}`,
      },
      method: 'POST',
      body: JSON.stringify({
        name: 'Starter Application',
        description: 'Example',
        loginRedirectUri: 'https://127.0.0.1:5173/dashboard',
        allowedCallbackUrls: ['http://localhost:5173', 'http://localhost:5173/dashboard'],
        allowedLogoutUrls: ['http://localhost:5173'],
        allowedWebOriginsUrls: ['http://localhost:5173'],
        allowedCORSOriginsUrls: ['http://localhost:5173'],
      }),
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw new Error(`Failed to create application. Status: ${response.status}`);
        }
      })
      .then((data) => resolve(data.clientId))
      .catch((error) => reject(error));
  });
}

function createM2M(accessToken: string, projectId: string): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    fetch('https://project-api.zapehr.com/v1/m2m', {
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
          ],
        },
      }),
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw new Error(`Failed to create M2M client. Status: ${response.status}`);
        }
      })
      .then((data) => {
        const m2mId = data.id;
        const m2mClientId = data.clientId;

        fetch(`https://project-api.zapehr.com/v1/m2m/${m2mId}/rotate-secret`, {
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
            resolve([m2mClientId, m2mSecret]);
          })
          .catch((error) => reject(error));
      })
      .catch((error) => reject(error));
  });
}

function createZambdaEnv(projectId: string, m2mClientId: string, m2mSecret: string): void {
  const envData = {
    AUTH0_ENDPOINT: 'https://auth.zapehr.com/oauth/token',
    AUTH0_AUDIENCE: 'https://api.zapehr.com',
    AUTH0_CLIENT: m2mClientId,
    AUTH0_SECRET: m2mSecret,
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    PROJECT_ID: projectId,
  };

  const envFolderPath = '/Users/nathan/Development/zapEHR/ottehr/packages/zambdas/.env';
  const envPath = path.join(envFolderPath, 'local.json');

  if (!fs.existsSync(envFolderPath)) {
    fs.mkdirSync(envFolderPath, { recursive: true });
  }
  console.log('envPath', envPath, 'envData', envData);
  fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
}

function duplicateEnvTemplate(clientId: string, projectId: string): void {
  const envTemplatePath = 'packages/app/env/.env.local-template';
  const envPath = 'packages/app/env/.env.local';

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  const updatedData = templateData
    .replace('VITE_APP_CLIENT_ID=placeholder_client_id', `VITE_APP_CLIENT_ID=${clientId}`)
    .replace('VITE_PROJECT_ID="placeholder_project_id"', `VITE_PROJECT_ID="${projectId}"`);

  // Write the updated data to the new file
  fs.writeFileSync(envPath, updatedData);
}

async function runCLI(): Promise<void> {
  const { accessToken, projectId } = await getUserInput();
  console.log('Starting setup...');

  Promise.all([createApplication(accessToken, projectId), createM2M(accessToken, projectId)])
    .then(([clientId, [m2mClientId, m2mSecret]]) => {
      console.log('Scripts completed successfully.');

      // Run nodejs typescript to create packages/zambdas/.env/local.json
      createZambdaEnv(projectId, m2mClientId, m2mSecret);

      // Run nodejs typescript to duplicate packages/app/env/.env.local-template
      // and update it with application client ID and project ID
      duplicateEnvTemplate(clientId, projectId);
    })
    .catch((error) => {
      console.error('Error running scripts:', error);
      throw error;
    });
}

runCLI().catch(() => process.exit(1));
