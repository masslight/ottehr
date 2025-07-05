import { input } from '@inquirer/prompts';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import {
  Group,
  HealthcareService,
  InsurancePlan,
  Location,
  Medication,
  Organization,
  PractitionerRole,
} from 'fhir/r4b';

const savedM2MId = '87d5be2e-19a9-4be4-a799-cfde9c74229b';

function logWithTimestamp(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function getUserInput(): Promise<{
  accessToken: string;
  projectId: string;
  confirm: boolean;
}> {
  if (process.argv.length > 2) {
    return { projectId: process.argv[2], accessToken: process.argv[3], confirm: true };
  }
  const accessToken = await input({
    message: 'Please enter your access token:',
    validate: (input: any) => !!input || 'Access token is required',
  });
  const projectId = await input({
    message: 'Please enter your project id:',
    validate: (input: any) => !!input || 'Project id is required',
  });
  const confirm = await input({
    message:
      'WARNING: This script will delete a bunch of data in the project, not just that which was created using the setup script. Are you sure you want to continue (y/N)?',
    validate: (input: any) => !!input || 'Confirmation is required',
  });
  return {
    accessToken: accessToken,
    projectId: projectId,
    confirm: confirm.toLowerCase() === 'y',
  };
}

async function main(): Promise<void> {
  const { accessToken, projectId, confirm } = await getUserInput();

  if (!confirm) {
    console.log('Exiting script');
    return;
  }

  // initialize the SDK
  const oystehr = new Oystehr({ accessToken, projectId });

  // remove default patient role from the project
  logWithTimestamp('Removing default patient role from the project...');
  await oystehr.project.update({ signupEnabled: false, defaultPatientRoleId: null });
  logWithTimestamp('Default patient role removed from the project');

  // delete all Medication FHIR resources in the project
  logWithTimestamp('Deleting all Medications...');
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
    })
  ).unbundle();
  let deleteOperations: BatchInputDeleteRequest[] = medications.map((medication) => ({
    method: 'DELETE',
    url: `/Medication/${medication.id}`,
  }));
  await oystehr.fhir.batch({ requests: deleteOperations });
  logWithTimestamp(`deleted ${medications.length} Medications`);

  // delete all InsurancePlan FHIR resources in the project
  logWithTimestamp('Deleting all InsurancePlans...');
  let currentIndex = 0;
  let total = 1;
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<InsurancePlan>({
      resourceType: 'InsurancePlan',
      params: [
        {
          name: '_offset',
          value: currentIndex.toString(),
        },
        {
          name: '_count',
          value: '1000',
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    const batchOperations = unbundled.map((insurancePlan) => ({
      method: 'DELETE',
      url: `/InsurancePlan/${insurancePlan.id}`,
    }));
    await oystehr.fhir.batch({ requests: batchOperations as BatchInputDeleteRequest[] });
    logWithTimestamp(`Deleted a batch of ${unbundled.length} InsurancePlans`);
  }
  logWithTimestamp('Deleted all InsurancePlans');

  // delete all z3 buckets in the project
  logWithTimestamp('Deleting all z3 buckets...');
  const buckets = await oystehr.z3.listBuckets();
  for (const bucket of buckets) {
    await oystehr.z3.deleteBucket({ bucketName: bucket.name });
  }
  logWithTimestamp(`deleted ${buckets.length} z3 buckets`);

  // delete all Group FHIR resources in the project
  logWithTimestamp('Deleting all Groups...');
  const groups = (
    await oystehr.fhir.search<Group>({
      resourceType: 'Group',
    })
  ).unbundle();
  deleteOperations = groups.map((group) => ({ method: 'DELETE', url: `/Group/${group.id}` }));
  await oystehr.fhir.batch({ requests: deleteOperations });
  logWithTimestamp(`deleted ${groups.length} Groups`);

  // delete all Location FHIR resources in the project
  logWithTimestamp('Deleting all Locations...');
  const locations = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
    })
  ).unbundle();
  deleteOperations = locations.map((location) => ({ method: 'DELETE', url: `/Location/${location.id}` }));
  await oystehr.fhir.batch({ requests: deleteOperations });
  logWithTimestamp(`deleted ${locations.length} Locations`);

  // delete all PractitionerRole FHIR resources in the project
  logWithTimestamp('Deleting all PractitionerRoles...');
  const practitionerRoles = (
    await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
    })
  ).unbundle();
  deleteOperations = practitionerRoles.map((practitionerRole) => ({
    method: 'DELETE',
    url: `/PractitionerRole/${practitionerRole.id}`,
  }));
  await oystehr.fhir.batch({ requests: deleteOperations });
  logWithTimestamp(`deleted ${practitionerRoles.length} PractitionerRoles`);

  // delete all HealthcareService FHIR resources in the project
  logWithTimestamp('Deleting all HealthcareServices...');
  const healthcareServices = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
    })
  ).unbundle();
  deleteOperations = healthcareServices.map((healthcareService) => ({
    method: 'DELETE',
    url: `/HealthcareService/${healthcareService.id}`,
  }));
  await oystehr.fhir.batch({ requests: deleteOperations });
  logWithTimestamp(`deleted ${healthcareServices.length} HealthcareServices`);

  // delete all users in the project
  logWithTimestamp('Deleting all users...');
  const users = await oystehr.user.list();
  for (const user of users) {
    await oystehr.user.delete({ id: user.id });
  }
  logWithTimestamp(`deleted ${users.length} users`);

  // delete all Organization FHIR resources in the project
  logWithTimestamp('Deleting all Organizations...');
  currentIndex = 0;
  total = 1;
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: '1000',
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    const batchOperations = unbundled.map((organization) => ({
      method: 'DELETE',
      url: `/Organization/${organization.id}`,
    }));
    await oystehr.fhir.batch({ requests: batchOperations as BatchInputDeleteRequest[] });
    logWithTimestamp(`Deleted a batch of ${unbundled.length} Organizations`);
  }
  logWithTimestamp('Deleted all Organizations');

  // delete all applications in the project
  logWithTimestamp('Deleting all applications...');
  const applications = await oystehr.application.list();
  for (const application of applications) {
    await oystehr.application.delete({ id: application.id });
  }
  logWithTimestamp(`deleted ${applications.length} applications`);

  // delete all m2m clients in the project
  logWithTimestamp('Deleting all M2M clients...');
  const m2mClients = await oystehr.m2m.list();
  for (const m2mClient of m2mClients) {
    if (m2mClient.id == savedM2MId) {
      continue;
    }
    await oystehr.m2m.delete({ id: m2mClient.id });
  }
  logWithTimestamp(`deleted ${m2mClients.length} M2M clients`);

  // delete all roles in the project
  logWithTimestamp('Deleting all IAM roles...');
  const iamRoles = await oystehr.role.list();
  for (const iamRole of iamRoles) {
    await oystehr.role.delete({ roleId: iamRole.id });
  }
  logWithTimestamp(`deleted ${iamRoles.length} IAM roles`);
}

main().catch((e) => {
  logWithTimestamp(`Error: ${e}`);
  console.error(e);
  process.exit(1);
});
