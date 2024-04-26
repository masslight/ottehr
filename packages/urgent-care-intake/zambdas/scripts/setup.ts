/* eslint-disable sort-keys */
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FhirClient } from '@zapehr/sdk';
import { Organization } from 'fhir/r4';
import { defaultLocation, defaultQuestionnaire } from './shared';

async function createApplication(
  projectApiUrl: string,
  applicationName: string,
  accessToken: string,
  projectId: string,
): Promise<[string, string]> {
  return new Promise(async (resolve, reject) => {
    console.log('building access policy');
    console.log('searching for exisiting roles for the project');
    const accessPolicy = {
      rule: [
        {
          resource: 'Zambda:Function:todo',
          action: ['Zambda:InvokeFunction'],
          effect: 'Allow',
        },
      ],
    };
    const existingRoles = await fetch(`${projectApiUrl}/iam/roles`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-zapehr-project-id': `${projectId}`,
      },
    });
    const rolesData = await existingRoles.json();
    console.log('existingRoles: ', rolesData);
    let patientRole;
    if (rolesData.length > 0) {
      patientRole = rolesData.find((role: any) => role.name === 'Patient');
    }
    if (patientRole) {
      console.log('patient role found: ', patientRole);
      const patientRoleRes = await fetch(`${projectApiUrl}/iam/roles/${patientRole.id}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-zapehr-project-id': `${projectId}`,
        },
        body: JSON.stringify({ accessPolicy: accessPolicy }),
      });
      patientRole = await patientRoleRes.json();
      console.log('patientRole inlineAccessPolicy patch: ', patientRole);
    } else {
      console.log('creating patient role');
      const patientRoleRes = await fetch(`${projectApiUrl}/iam/roles`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-zapehr-project-id': `${projectId}`,
        },
        body: JSON.stringify({ name: 'Patient', accessPolicy: accessPolicy }),
      });
      patientRole = await patientRoleRes.json();
      console.log('patientRole: ', patientRole);
    }
    console.group('setting default patient role for project');
    const endpoint = `${projectApiUrl}/project`;
    console.log('sending to endpoint: ', endpoint);
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-zapehr-project-id': `${projectId}`,
      },
      body: JSON.stringify({ defaultPatientRoleId: patientRole.id, signupEnabled: true }),
    });

    const resData = await response.json();
    console.log('response json: ', resData);
    console.groupEnd();
    if (response.status === 200) {
      console.log('successfully updated default patient role');
    } else {
      throw new Error('Failed to update default patient role');
    }

    fetch(`${projectApiUrl}/application`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': `${projectId}`,
      },
      method: 'POST',
      body: JSON.stringify({
        name: applicationName,
        description: 'Intake application with sms authentication',
        loginRedirectUri: 'https://127.0.0.1:3015/patients',
        allowedCallbackUrls: ['http://localhost:3015', 'http://localhost:3015/patients'],
        allowedLogoutUrls: ['http://localhost:3015'],
        allowedWebOriginsUrls: ['http://localhost:3015'],
        allowedCORSOriginsUrls: ['http://localhost:3015'],
        loginWithEmailEnabled: true,
        passwordlessSMS: true,
        mfaEnabled: false,
        shouldSendInviteEmail: false,
        logoUri:
          'https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg',
      }),
    })
      .then(async (response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          // console.log(await response.json());
          console.log(JSON.stringify(await response.json()));
          console.log(response.body);
          throw new Error(`Failed to create application. Status: ${response.status}`);
        }
      })
      .then((data) => resolve([data.id, data.clientId]))
      .catch((error) => reject(error));
  });
}

function createZambdaLocalEnvFile(
  projectId: string,
  m2mDeviceId: string,
  m2mClientId: string,
  m2mSecret: string,
  organizationId: string,
): string {
  const overrideData = {
    AUTH0_ENDPOINT: 'https://auth.zapehr.com/oauth/token',
    AUTH0_AUDIENCE: 'https://api.zapehr.com',
    AUTH0_CLIENT: m2mClientId,
    AUTH0_SECRET: m2mSecret,
    // todo use a different m2m for this
    MESSAGING_DEVICE_ID: m2mDeviceId,
    MESSAGING_M2M_CLIENT: m2mClientId,
    MESSAGING_M2M_SECRET: m2mSecret,
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    ORGANIZATION_ID: organizationId,
    PROJECT_ID: projectId,
  };

  const envFolderPath = 'packages/urgent-care-intake/zambdas/.env';
  const envPath = path.join(envFolderPath, 'local.json');
  const envTemplatePath = path.join(envFolderPath, 'local.template.json');

  // Read the template file
  const templateData = JSON.parse(fs.readFileSync(envTemplatePath, 'utf8'));

  const envData = { ...templateData, ...overrideData };

  if (!fs.existsSync(envFolderPath)) {
    fs.mkdirSync(envFolderPath, { recursive: true });
  }
  fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
  return envPath;
}

function createAppLocalEnvFile(clientId: string): string {
  const envTemplatePath = 'packages/urgent-care-intake/app/env/.env.local-template';
  const envPath = 'packages/urgent-care-intake/app/env/.env.local';

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  const updatedData = templateData.replace(
    'VITE_APP_APPLICATION_CLIENT_ID=placeholder_client_id',
    `VITE_APP_APPLICATION_CLIENT_ID=${clientId}`,
  );

  // Write the updated data to the new file
  fs.writeFileSync(envPath, updatedData);
  return envPath;
}

const createOrganization = async (fhirClient: FhirClient): Promise<Organization> => {
  const organization: Organization = {
    resourceType: 'Organization',
    active: true,
    name: 'Example Organization',
  };

  return await fhirClient.createResource(organization);
};

const createQuestionnaire = async (fhirClient: FhirClient) => {
  const newQuestionnaire = defaultQuestionnaire;

  const prevQuestionnaire = await fhirClient.searchResources({
    resourceType: 'Questionnaire',
    searchParams: [
      {
        name: 'name',
        value: newQuestionnaire.name || 'paperwork',
      },
    ],
  });

  console.log('Received questionnaires from fhir.');

  if (!prevQuestionnaire.length) {
    return await fhirClient.createResource(newQuestionnaire);
  } else {
    console.log('Questionnaire already exists.');
    return null;
  }
};

const createLocation = async (fhirClient: FhirClient) => {
  const newLocation = defaultLocation;

  const prevLocations = await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [
      {
        name: 'name',
        value: newLocation.name || 'Testing',
      },
    ],
  });

  console.log('Received locations from fhir.');

  if (!prevLocations.length) {
    return await fhirClient.createResource(newLocation);
  } else {
    console.log('Location already exists.');
    return null;
  }
};

export async function setupIntake(
  projectApiUrl: string,
  accessToken: string,
  projectId: string,
  providerEmail: string,
  m2mDeviceId: string,
  m2mClientId: string,
  m2mSecret: string,
): Promise<void> {
  console.log('Starting setup of Ottehr Urgent Care Intake...');
  const slug = uuidv4().replace(/-/g, '');

  const fhirClient = new FhirClient({
    apiUrl: 'https://fhir-api.zapehr.com',
    projectId: projectId,
    accessToken: accessToken,
  });

  const applicationName = 'Ottehr Urgent Care Intake';
  const [applicationId, clientId] = await createApplication(projectApiUrl, applicationName, accessToken, projectId);
  console.log(`Created application "${applicationName}".`);
  console.log(applicationId, clientId);

  const organizationID = (await createOrganization(fhirClient)).id;
  if (!organizationID) {
    throw new Error('Organization ID is not defined');
  }
  await createQuestionnaire(fhirClient);
  await createLocation(fhirClient);

  const envPath1 = createZambdaLocalEnvFile(projectId, m2mDeviceId, m2mClientId, m2mSecret, organizationID);
  console.log('Created environment file:', envPath1);

  const envPath2 = createAppLocalEnvFile(clientId);
  console.log('Created environment file:', envPath2);
  console.log('Setup of urgent care testing');
}
