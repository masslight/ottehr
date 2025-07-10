import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { exec } from 'child_process';
import { FhirResource, HealthcareService, Organization, PractitionerRole, Schedule } from 'fhir/r4b';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
  FHIR_BASE_URL,
  FOLDERS_CONFIG,
  generateDeployAccountNumber,
  PROJECT_DOMAIN,
  PROJECT_NAME,
  PROJECT_NAME_LOWER,
  SCHEDULE_EXTENSION_URL,
  ScheduleStrategyCoding,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { inviteUser } from './invite-user';
import { defaultGroup } from './setup-default-locations';

async function createApplication(oystehr: Oystehr, applicationName: string): Promise<[string, string]> {
  const application = await oystehr.application.create({
    name: applicationName,
    description: 'EHR application with email authentication',
    loginRedirectUri: 'https://ehr-local.ottehr.com/dashboard',
    allowedCallbackUrls: [
      'http://localhost:4002',
      'http://localhost:4002/dashboard',
      'https://localhost:4002',
      'https://localhost:4002/dashboard',
    ],
    allowedLogoutUrls: ['http://localhost:4002', 'https://localhost:4002'],
    allowedWebOriginsUrls: ['http://localhost:4002', 'https://localhost:4002'],
    allowedCORSOriginsUrls: ['http://localhost:4002', 'https://localhost:4002'],
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

  const envFolderPath = 'packages/zambdas/.env';
  const envPath = path.join(envFolderPath, `${environment}.json`);
  const envTemplatePath = path.join(envFolderPath, 'local.template.json');

  // Read the template file
  const templateData = JSON.parse(fs.readFileSync(envTemplatePath, 'utf8'));

  const envData = { ...templateData, ...overrideData };

  // Handle TLS certificate
  if (fs.existsSync(path.join(envFolderPath, 'cert.pem')) && fs.existsSync(path.join(envFolderPath, 'key.pem'))) {
    envData.WEBSITE_URL = 'https://localhost';
  }

  if (!fs.existsSync(envFolderPath)) {
    fs.mkdirSync(envFolderPath, { recursive: true });
  }
  fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
  return envPath;
}

function createFrontEndEnvFile(
  clientId: string,
  environment: string,
  projectId: string,
  applicationId: string
): string {
  const envFolderPath = 'apps/ehr/env';
  const envTemplatePath = path.join(envFolderPath, '.env.local-template');
  const envPath = path.join(envFolderPath, `.env.${environment}`);

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  let updatedData = templateData
    .replace('VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID=', `VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID=${clientId}`)
    .replace('VITE_APP_ENV=', `VITE_APP_ENV=${environment}`)
    .replace('VITE_APP_PROJECT_ID=', `VITE_APP_PROJECT_ID=${projectId}`)
    .replace('VITE_APP_OYSTEHR_APPLICATION_ID=APPLICATION_ID', `VITE_APP_OYSTEHR_APPLICATION_ID=${applicationId}`);

  // Handle TLS certificate
  if (fs.existsSync(path.join(envFolderPath, 'cert.pem')) && fs.existsSync(path.join(envFolderPath, 'key.pem'))) {
    updatedData = updatedData.replace('http://localhost', 'https://localhost');
  }

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

  const applicationName = `${PROJECT_NAME} EHR`;
  const [applicationId, clientId] = await createApplication(oystehr, applicationName);
  console.log(`Created application "${applicationName}".`);

  const organizationId = (await createOrganization(oystehr)).id;
  if (!organizationId) {
    throw new Error('Organization ID is not defined');
  }

  console.log('Starting to create sample provider.');
  const firstName = undefined;
  const lastName = undefined;
  const { invitationUrl: invitationUrl1, userProfileId: userId1 } = await inviteUser(
    oystehr,
    providerEmail,
    firstName,
    lastName,
    applicationId,
    true,
    'practitioner1'
  );

  const provider2Email = 'jane.smith@' + PROJECT_DOMAIN;
  const { userProfileId: userId2 } = await inviteUser(
    oystehr,
    provider2Email,
    'Jane',
    'Smith',
    applicationId,
    true,
    'practitioner2'
  );

  const provider3Email = 'kevin.brown@' + PROJECT_DOMAIN;
  const { userProfileId: userId3 } = await inviteUser(
    oystehr,
    provider3Email,
    'Kevin',
    'Brown',
    applicationId,
    true,
    'practitioner3'
  );

  // create a group for the providers using the HealthcareService fhir resource
  // hs post requests
  const healthcareServicePostRequests: BatchInputPostRequest<FhirResource>[] = [];
  const healthcareServiceResource: HealthcareService = {
    resourceType: 'HealthcareService',
    name: defaultGroup,
    active: true,
    identifier: [
      {
        system: FHIR_BASE_URL + '/r4/slug',
        value: 'visit-followup-group',
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

  const hsPostRequest: BatchInputPostRequest<HealthcareService> = {
    method: 'POST',
    url: '/HealthcareService',
    resource: healthcareServiceResource,
    fullUrl: 'urn:uuid:default-hs-post-request',
  };
  healthcareServicePostRequests.push(hsPostRequest);

  // create a PractitionerRole for each provider
  const userProfileIds = [userId1, userId2, userId3];
  for (const userId of userProfileIds) {
    if (!userId) {
      continue;
    }
    const practitionerRoleResource: PractitionerRole = {
      resourceType: 'PractitionerRole',
      practitioner: {
        reference: `Practitioner/${userId}`,
      },
      healthcareService: [
        {
          reference: hsPostRequest.fullUrl,
        },
      ],
    };

    const practitionerRolePostRequest: BatchInputPostRequest<FhirResource> = {
      method: 'POST',
      url: '/PractitionerRole',
      resource: practitionerRoleResource,
      fullUrl: `urn:uuid:${userId}-practitioner-role`,
    };
    healthcareServicePostRequests.push(practitionerRolePostRequest);

    /* 
      for each practitioner in the group, create a schedule resource - 
      the set of bookable slots at any given time for the healthcare service 
      is determined by pooling these individual provider schedules
    */
    const providerSchedule: Schedule = {
      resourceType: 'Schedule',
      active: true,
      extension: [
        {
          url: TIMEZONE_EXTENSION_URL,
          valueString: 'America/New_York',
        },
        {
          url: SCHEDULE_EXTENSION_URL,
          valueString:
            '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
        },
      ],
      actor: [
        {
          reference: `Practitioner/${userId}`,
        },
      ],
    };
    healthcareServicePostRequests.push({
      method: 'POST',
      url: '/Schedule',
      resource: providerSchedule,
    });
  }
  await oystehr.fhir.transaction<FhirResource>({ requests: healthcareServicePostRequests });
  console.log('Created healthcare service and practitioner roles.');

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
          system: `${PROJECT_NAME_LOWER}-internal`,
          value: 'intake-issue-reports',
        },
      ],
      active: true,
      type: 'practitioner',
      code: {
        text: `${PROJECT_NAME_LOWER}-admins`,
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

  const envPath2 = createFrontEndEnvFile(clientId, environment, projectId, applicationId);
  console.log('Created environment file:', envPath2);

  const documentExplorerFolders = FOLDERS_CONFIG.map((folder) => folder.title);
  const bucketNames = [...documentExplorerFolders];

  await createZ3(oystehr, bucketNames);

  const execPromise = promisify(exec);
  try {
    console.log('Starting to update insurances and payer orgs...');
    const { stdout: stdout1, stderr: stderr1 } = await execPromise(
      `cd packages/zambdas && npm run update-insurances-and-payer-orgs ${environment}`
    );
    if (stderr1) {
      console.log(`Command executed with warnings: ${stderr1}`);
    } else {
      console.log(`stdout: ${stdout1}`);
      console.log('Update of insurances and payer orgs completed successfully.');
    }

    console.log('Starting to update in-house medications list...');
    const { stdout: stdout2, stderr: stderr2 } = await execPromise(
      `cd packages/zambdas && npm run recreate-in-house-medications-list ${environment}`
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

  // External Labs setup
  try {
    console.log('Configuring external labs resources...');

    const accountNumber = generateDeployAccountNumber();
    const autoLabGuid = '790b282d-77e9-4697-9f59-0cef8238033a';

    try {
      await oystehr.lab.routeCreate({ labGuid: autoLabGuid, accountNumber });
    } catch (error) {
      console.log(`Error while creating a route with account number ${accountNumber}`);
      throw error;
    }

    const autoLabOrg: Organization = {
      resourceType: 'Organization',
      name: 'AutoLab',
      identifier: [
        {
          system: 'https://identifiers.fhir.oystehr.com/lab-guid',
          value: autoLabGuid,
        },
        {
          system: 'https://identifiers.fhir.oystehr.com/lab-account-number',
          value: accountNumber,
        },
      ],
      type: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '261904005',
              display: 'Laboratory',
            },
          ],
        },
      ],
      contact: [
        {
          name: {
            family: 'Smith',
            given: ['John'],
          },
          telecom: [
            {
              system: 'phone',
              value: '+12223334444',
            },
          ],
          purpose: {
            coding: [
              {
                system: 'https://identifiers.fhir.oystehr.com/lab-director-contact',
                code: 'lab_director',
                display: 'Lab Director',
              },
            ],
          },
        },
      ],
    };

    await oystehr.fhir.create(autoLabOrg);
    console.log('Successfully configured external labs resources...');
  } catch (error: any) {
    console.log(`Error occurred while setting up external labs AutoLab org: ${error.message}`);
  }

  // In House labs
  try {
    console.log('Configuring In-House Lab resources...');
    const { stdout: stdout1, stderr: stderr1 } = await execPromise(
      `cd packages/zambdas && npm run make-in-house-test-items ${environment}`
    );
    if (stderr1) {
      console.log(`Command executed with warnings: ${stderr1}`);
    } else {
      console.log(`stdout: ${stdout1}`);
      console.log('In-House Lab resources configured successfully!');
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
