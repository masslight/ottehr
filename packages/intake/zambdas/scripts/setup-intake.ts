import fs from 'fs';
import path from 'path';
import Oystehr, { AccessPolicy, Application } from '@oystehr/sdk';
import { TIMEZONE_EXTENSION_URL } from 'utils';
import { FhirResource, Organization, Location } from 'fhir/r4b';
import { checkLocations } from './setup-default-locations';

export const defaultLocation: Location = {
  resourceType: 'Location',
  status: 'active',
  name: 'Testing',
  description: 'Test description',
  identifier: [
    {
      system: 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
      value: 'testing',
    },
  ],
  address: {
    use: 'work',
    type: 'physical',
    line: ['12345 Test St'],
    city: 'Test City',
    state: 'Test State',
    postalCode: '12345',
  },
  telecom: [
    {
      system: 'phone',
      use: 'work',
      value: '1234567890',
    },
    {
      system: 'url',
      use: 'work',
      value: 'https://example.com',
    },
  ],
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
      valueString:
        '{"schedule":{"monday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":10},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"tuesday":{"open":8,"close":21,"openingBuffer":0,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":10},{"hour":9,"capacity":5},{"hour":10,"capacity":7},{"hour":11,"capacity":4},{"hour":12,"capacity":8},{"hour":13,"capacity":11},{"hour":14,"capacity":1},{"hour":15,"capacity":2},{"hour":16,"capacity":1},{"hour":17,"capacity":1},{"hour":18,"capacity":2},{"hour":19,"capacity":2},{"hour":20,"capacity":6}]},"wednesday":{"open":8,"close":0,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":20},{"hour":9,"capacity":20},{"hour":10,"capacity":20},{"hour":11,"capacity":20},{"hour":12,"capacity":20},{"hour":13,"capacity":20},{"hour":14,"capacity":20},{"hour":15,"capacity":20},{"hour":16,"capacity":20},{"hour":17,"capacity":20},{"hour":18,"capacity":20},{"hour":19,"capacity":20},{"hour":20,"capacity":20},{"hour":21,"capacity":20},{"hour":22,"capacity":20},{"hour":23,"capacity":20}]},"thursday":{"open":18,"close":24,"openingBuffer":30,"closingBuffer":0,"workingDay":true,"hours":[{"hour":0,"capacity":0},{"hour":1,"capacity":0},{"hour":2,"capacity":0},{"hour":3,"capacity":0},{"hour":4,"capacity":0},{"hour":5,"capacity":0},{"hour":6,"capacity":0},{"hour":7,"capacity":0},{"hour":8,"capacity":0},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":12},{"hour":18,"capacity":10},{"hour":19,"capacity":10},{"hour":20,"capacity":10},{"hour":21,"capacity":0},{"hour":22,"capacity":10},{"hour":23,"capacity":10}]},"friday":{"open":14,"close":21,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":14,"capacity":5},{"hour":15,"capacity":6},{"hour":16,"capacity":6},{"hour":17,"capacity":5},{"hour":18,"capacity":5},{"hour":19,"capacity":5},{"hour":20,"capacity":5}]},"saturday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"sunday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]}},"scheduleOverrides":{"12/21/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"12/9/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"05/01/2024":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"1/19/2024":{"open":7,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]}}}',
    },
    {
      url: TIMEZONE_EXTENSION_URL,
      valueString: 'America/New_York',
    },
  ],
  hoursOfOperation: [
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['mon'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['tue'],
    },
    {
      openingTime: '08:00:00',
      closingTime: '00:00:00',
      daysOfWeek: ['wed'],
    },
    {
      openingTime: '18:00:00',
      daysOfWeek: ['thu'],
    },
    {
      openingTime: '14:00:00',
      closingTime: '21:00:00',
      daysOfWeek: ['fri'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sat'],
    },
    {
      openingTime: '04:00:00',
      closingTime: '20:00:00',
      daysOfWeek: ['sun'],
    },
  ],
};

async function createApplication(oystehr: Oystehr, applicationName: string): Promise<[string, string]> {
  // Build access policy
  console.log('building access policy');
  const accessPolicy: AccessPolicy = {
    rule: [
      {
        resource: [
          'Zambda:Function:telemed-get-patients',
          'Zambda:Function:telemed-get-appointments',
          'Zambda:Function:telemed-create-appointment',
          'Zambda:Function:telemed-get-paperwork',
          'Zambda:Function:telemed-create-paperwork',
          'Zambda:Function:telemed-cancel-telemed-appointment',
          'Zambda:Function:check-in',
          'Zambda:Function:create-appointment',
          'Zambda:Function:cancel-appointment',
          'Zambda:Function:get-patients',
          'Zambda:Function:update-appointment',
          'Zambda:Function:get-schedule',
          'Zambda:Function:intake-get-appointments',
          'Zambda:Function:get-paperwork',
          'Zambda:Function:update-paperwork-in-progress',
          'Zambda:Function:get-presigned-file-url',
          'Zambda:Function:get-appointment-details',
          'Zambda:Function:patch-paperwork',
          'Zambda:Function:submit-paperwork',
          'Zambda:Function:payment-methods-list',
          'Zambda:Function:payment-methods-delete',
          'Zambda:Function:payment-methods-setup',
          'Zambda:Function:payment-methods-set-default',
          'Zambda:Function:video-chat-invites-cancel',
          'Zambda:Function:video-chat-invites-create',
          'Zambda:Function:video-chat-invites-list',
          'Zambda:Function:get-eligibility',
          'Zambda:Function:get-answer-options',
          'Zambda:Function:get-telemed-states',
          'Zambda:Function:get-wait-status',
          'Zambda:Function:get-past-visits',
          'Zambda:Function:join-call',
          'Zambda:Function:telemed-cancel-appointment',
          'Zambda:Function:telemed-update-appointment',
          'Zambda:Function:get-visit-details',
          'Zambda:Function:list-bookables',
          'Zambda:Function:intake-version',
        ],
        action: ['Zambda:InvokeFunction'],
        effect: 'Allow',
      },
      {
        action: ['Telemed:JoinMeeting'],
        effect: 'Allow',
        resource: ['Telemed:Meeting'],
      },
      {
        action: ['FHIR:Read'],
        effect: 'Allow',
        resource: ['FHIR:Encounter'],
      },
    ],
  };

  // Search for existing roles
  console.log('searching for existing roles for the project');
  const existingRoles = await oystehr.role.list();
  console.log('existingRoles: ', existingRoles);

  // Handle patient role
  let patientRole;
  const existingPatientRole = existingRoles.find((role: any) => role.name === 'Patient');

  if (existingPatientRole) {
    console.log('patient role found: ', existingPatientRole);
    patientRole = await oystehr.role.update({ roleId: existingPatientRole.id, accessPolicy });
    console.log('patientRole inlineAccessPolicy patch: ', patientRole);
  } else {
    console.log('creating patient role');
    patientRole = await oystehr.role.create({ name: 'Patient', accessPolicy });
    console.log('patientRole: ', patientRole);
  }

  // Set default patient role
  try {
    console.group('setting default patient role for project');
    const projectData = await oystehr.project.update({ defaultPatientRoleId: patientRole.id, signupEnabled: true });
    console.log('response json: ', projectData);
    console.groupEnd();
  } catch (err) {
    throw new Error('Failed to update default patient role');
  }
  console.log('successfully updated default patient role');

  // Create application
  let application: Application;
  try {
    application = await oystehr.application.create({
      name: applicationName,
      description: 'Intake application with sms authentication',
      loginRedirectUri: 'https://intake-local.ottehr.com/patients',
      allowedCallbackUrls: [
        'http://localhost:3002',
        'http://localhost:3002/patients',
        'http://localhost:3002/redirect',
      ],
      allowedLogoutUrls: ['http://localhost:3002'],
      allowedWebOriginsUrls: ['http://localhost:3002'],
      allowedCORSOriginsUrls: ['http://localhost:3002'],
      loginWithEmailEnabled: true,
      passwordlessSMS: true,
      mfaEnabled: false,
      shouldSendInviteEmail: false,
      logoUri:
        'https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg',
    });
  } catch (err) {
    console.log(JSON.stringify(err));
    throw new Error(`Failed to create application. Status: ${(err as Oystehr.OystehrSdkError).code}`);
  }
  return [application.id, application.clientId];
}

function createZambdaEnvFile(
  projectId: string,
  m2mClientId: string,
  m2mSecret: string,
  organizationId: string,
  environment: string
): string {
  const overrideData = {
    AUTH0_ENDPOINT: 'https://auth.zapehr.com/oauth/token',
    AUTH0_AUDIENCE: 'https://api.zapehr.com',
    TELEMED_CLIENT_ID: m2mClientId,
    TELEMED_CLIENT_SECRET: m2mSecret,
    AUTH0_CLIENT: m2mClientId,
    AUTH0_SECRET: m2mSecret,
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    ORGANIZATION_ID: organizationId,
    PROJECT_ID: projectId,
    ENVIRONMENT: environment,
  };

  const envFolderPath = 'packages/intake/zambdas/.env';
  const envPath = path.join(envFolderPath, `${environment}.json`);
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

function createAppEnvFile(clientId: string, environment: string, projectId: string): string {
  const envTemplatePath = 'apps/intake/env/.env.local-template';
  const envPath = `apps/intake/env/.env.${environment}`;

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  let updatedData = templateData
    .replace('VITE_APP_CLIENT_ID=', `VITE_APP_CLIENT_ID=${clientId}`)
    .replace('VITE_APP_PROJECT_ID=', `VITE_APP_PROJECT_ID=${projectId}`);
  if (environment !== 'local') {
    updatedData = updatedData.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  }

  // Write the updated data to the new file
  fs.writeFileSync(envPath, updatedData);
  return envPath;
}

const createOrganization = async (oystehr: Oystehr): Promise<Organization> => {
  const organization: FhirResource = {
    resourceType: 'Organization',
    active: true,
    name: 'Example Organization',
  };

  return await oystehr.fhir.create(organization);
};

export async function setupIntake(
  oystehr: Oystehr,
  projectId: string,
  m2mClientId: string,
  m2mSecret: string,
  environment: string
): Promise<void> {
  console.log('Starting setup of Ottehr Intake...');

  const applicationName = 'Ottehr Intake';
  const [_, clientId] = await createApplication(oystehr, applicationName);
  console.log(`Created application "${applicationName}".`);

  const organizationID = (await createOrganization(oystehr)).id;
  if (!organizationID) {
    throw new Error('Organization ID is not defined');
  }
  await checkLocations(oystehr);

  const envPath1 = createZambdaEnvFile(projectId, m2mClientId, m2mSecret, organizationID, environment);
  console.log('Created environment file:', envPath1);

  const envPath2 = createAppEnvFile(clientId, environment, projectId);
  console.log('Created environment file:', envPath2);
  console.log('Setup of telemed intake testing');
}
