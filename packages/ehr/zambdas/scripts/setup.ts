import Oystehr from '@oystehr/sdk';
import { exec } from 'child_process';
import { FhirResource, Organization } from 'fhir/r4b';
import fs from 'fs';
import path from 'path';
import { ScheduleStrategyCoding, TIMEZONE_EXTENSION_URL } from 'utils';
import { inviteUser } from './invite-user';
import { promisify } from 'node:util';

async function createApplication(oystehr: Oystehr, applicationName: string): Promise<[string, string]> {
  const application = await oystehr.application.create({
    name: applicationName,
    description: 'EHR application with email authentication',
    loginRedirectUri: 'https://ehr-local.ottehr.com/dashboard',
    allowedCallbackUrls: ['http://localhost:4002', 'http://localhost:4002/dashboard'],
    allowedLogoutUrls: ['http://localhost:4002'],
    allowedWebOriginsUrls: ['http://localhost:4002'],
    allowedCORSOriginsUrls: ['http://localhost:4002'],
    shouldSendInviteEmail: true,
  });
  return [application.id, application.clientId];
}

const createOrganization = async (oystehr: Oystehr): Promise<Organization> => {
  const organization: FhirResource = {
    resourceType: 'Organization',
    active: true,
    name: 'Example Organization',
  };

  return await oystehr.fhir.create(organization);
};

function createZambdaEnvFile(
  projectId: string,
  m2mClientId: string,
  m2mSecret: string,
  organizationId: string,
  groupId: string,
  environment: string
): string {
  const overrideData = {
    AUTH0_ENDPOINT: 'https://auth.zapehr.com/oauth/token',
    AUTH0_AUDIENCE: 'https://api.zapehr.com',
    AUTH0_CLIENT: m2mClientId,
    AUTH0_SECRET: m2mSecret,
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    PROJECT_ID: projectId,
    ORGANIZATION_ID: organizationId,
    INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID: groupId,
    ENVIRONMENT: environment,
  };

  const envFolderPath = 'packages/ehr/zambdas/.env';
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

function createFrontEndEnvFile(clientId: string, environment: string, projectId: string): string {
  const envTemplatePath = 'apps/ehr/env/.env.local-template';
  const envPath = `apps/ehr/env/.env.${environment}`;

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  const updatedData = templateData
    .replace('VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID=', `VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID=${clientId}`)
    .replace('VITE_APP_ENV=', `VITE_APP_ENV=${environment}`)
    .replace('VITE_APP_PROJECT_ID=', `VITE_APP_PROJECT_ID=${projectId}`);

  // Write the updated data to the new file
  fs.writeFileSync(envPath, updatedData);
  return envPath;
}

async function createZ3(oystehr: Oystehr, bucketNames: string[]): Promise<void> {
  const existingBuckets = await oystehr.z3.listBuckets();

  const promises = bucketNames
    .map(async (bucketName) => {
      const fqBucketName = `${oystehr.config.projectId}-${bucketName}`;

      const foundBucket = existingBuckets.find((eb: { name: string }) => eb.name === fqBucketName);
      if (foundBucket !== undefined) {
        console.log(`Bucket ${fqBucketName} already exists.`);
        return null;
      }

      console.log(`Creating bucket ${fqBucketName}.`);

      try {
        return await oystehr.z3.createBucket({ bucketName: fqBucketName });
      } catch (err) {
        console.error(`Failed to create bucket`, err);
        throw new Error('Failed to create bucket');
      }
    })
    .filter((promiseOrNull) => promiseOrNull !== null);

  await Promise.all(promises);
}

export async function setupEHR(
  oystehr: Oystehr,
  projectId: string,
  providerEmail: string,
  m2mClientId: string,
  m2mSecret: string,
  environment: string
): Promise<void> {
  console.log('Starting setup of EHR...');

  const applicationName = 'Ottehr EHR';
  const [applicationId, clientId] = await createApplication(oystehr, applicationName);
  console.log(`Created application "${applicationName}".`);

  const organizationId = (await createOrganization(oystehr)).id;
  if (!organizationId) {
    throw new Error('Organization ID is not defined');
  }

  console.log('Starting to create sample provider.');
  const firstName = undefined;
  const lastName = undefined;
  const { invitationUrl: invitationUrl1, userId: userId1 } = await inviteUser(
    oystehr,
    providerEmail,
    firstName,
    lastName,
    applicationId,
    true,
    'practitioner1'
  );

  const provider2Email = 'jane.smith@ottehr.com';
  const { userId: userId2 } = await inviteUser(
    oystehr,
    provider2Email,
    'Jane',
    'Smith',
    applicationId,
    true,
    'practitioner2'
  );

  const provider3Email = 'kevin.brown@ottehr.com';
  const { userId: userId3 } = await inviteUser(
    oystehr,
    provider3Email,
    'Kevin',
    'Brown',
    applicationId,
    true,
    'practitioner3'
  );

  // create a group for the providers using the HealthcareService fhir resource
  const healthcareServiceResource: FhirResource = {
    resourceType: 'HealthcareService',
    name: 'Selden NY',
    active: true,
    extension: [
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString:
          '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
      },
    ],
    identifier: [
      {
        system: 'https://fhir.ottehr.com/r4/slug',
        value: 'SeldenNY',
      },
    ],
    characteristic: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/service-mode',
            code: 'in-person',
            display: 'In Person',
          },
        ],
      },
      {
        coding: [
          {
            system: ScheduleStrategyCoding.poolsAll.system,
            code: ScheduleStrategyCoding.poolsAll.code,
            display: ScheduleStrategyCoding.poolsAll.display,
          },
        ],
      },
    ],
  };
  const healthcareService = await oystehr.fhir.create(healthcareServiceResource);

  // create a PractitionerRole for each provider
  const userIds = [userId1, userId2, userId3];
  for (const userId of userIds) {
    if (!userId) {
      continue;
    }
    const practitionerRoleResource: FhirResource = {
      resourceType: 'PractitionerRole',
      practitioner: {
        reference: `Practitioner/${userId}`,
      },
      healthcareService: [
        {
          reference: `HealthcareService/${healthcareService.id}`,
        },
      ],
    };

    await oystehr.fhir.create(practitionerRoleResource);
  }

  // create a FHIR Group resource, for issue report email recipients
  // to populate this group, go to the console and locate the Group with ID equal to the
  // value of the INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID secret. Then, add the desired recipients
  // to the member array, and save the group.
  let groupId = '';
  if (userId1) {
    const groupResource: FhirResource = {
      resourceType: 'Group',
      identifier: [
        {
          system: 'ottehr-internal',
          value: 'intake-issue-reports',
        },
      ],
      active: true,
      type: 'practitioner',
      code: {
        text: 'ottehr-admins',
      },
      name: 'Issue Report Recipients',
      member: [
        {
          entity: {
            type: 'Practitioner',
            reference: `Practitioner/${userId1}`,
          },
        },
      ],
      actual: true,
    };
    const groupResponse = await oystehr.fhir.create(groupResource);
    groupId = groupResponse.id ?? '';
  }

  const envPath1 = createZambdaEnvFile(projectId, m2mClientId, m2mSecret, organizationId, groupId, environment);
  console.log('Created environment file:', envPath1);

  const envPath2 = createFrontEndEnvFile(clientId, environment, projectId);
  console.log('Created environment file:', envPath2);

  const bucketNames = [
    'photo-id-cards',
    'insurance-cards',
    'school-work-note-templates',
    'school-work-notes',
    'visit-notes',
    'consent-forms',
    'receipts',
    'patient-photos',
  ];

  await createZ3(oystehr, bucketNames);

  const execPromise = promisify(exec);
  try {
    console.log('Starting to update insurances and payer orgs...');
    const { stdout: stdout1, stderr: stderr1 } = await execPromise(
      `cd packages/ehr/zambdas && npm run update-insurances-and-payer-orgs ${environment}`
    );
    if (stderr1) {
      console.log(`Command executed with warnings: ${stderr1}`);
    } else {
      console.log(`stdout: ${stdout1}`);
      console.log('Update of insurances and payer orgs completed successfully.');
    }

    console.log('Starting to update in-house medications list...');
    const { stdout: stdout2, stderr: stderr2 } = await execPromise(
      `cd packages/ehr/zambdas && npm run create-update-in-house-medications-list ${environment}`
    );
    if (stderr2) {
      console.log(`Command executed with warnings: ${stderr2}`);
    } else {
      console.log(`stdout: ${stdout2}`);
      console.log('Update of in-house medications list completed successfully.');
    }
  } catch (error: any) {
    console.log(`Error occurred while executing command: ${error.message}`);
  }

  if (invitationUrl1) {
    console.log(
      `User with email \x1b[35m${providerEmail}\x1b[0m can gain access to their account by navigating to URL \x1b[35m${invitationUrl1}\x1b[0m`
    );
  }
  console.log(`Login to the provider dashboard by navigating to URL \x1b[35mhttp://localhost:4002\x1b[0m`);
}
