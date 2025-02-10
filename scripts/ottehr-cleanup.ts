import inquirer from 'inquirer';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Group, HealthcareService, InsurancePlan, Medication, Organization, PractitionerRole } from 'fhir/r4b';

async function getUserInput(): Promise<{
  accessToken: string;
  projectId: string;
}> {
  if (process.argv.length > 2) {
    return { projectId: process.argv[2], accessToken: process.argv[3] };
  }
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

async function main(): Promise<void> {
  const { accessToken, projectId } = await getUserInput();

  // initialize the SDK
  const oystehr = new Oystehr({ accessToken, projectId });

  // remove default patient role from the project
  console.log('Removing default patient role from the project...');
  await oystehr.project.update({ signupEnabled: false, defaultPatientRoleId: null });
  console.log('Default patient role removed from the project');

  //   delete all Medication FHIR resources in the project
  console.log('Deleting all Medications...');
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
    })
  ).unbundle();
  let deleteOperations: BatchInputDeleteRequest[] = medications.map((medication) => ({
    method: 'DELETE',
    url: `/Medication/${medication.id}`,
  }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${medications.length} Medications`);

  // delete all InsurancePlan FHIR resources in the project
  console.log('Deleting all InsurancePlans...');
  let currentIndex = 0;
  let total = 1;
  const insurancePlans: InsurancePlan[] = [];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<InsurancePlan>({
      resourceType: 'InsurancePlan',
      params: [
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    insurancePlans.push(...unbundled);
    currentIndex += unbundled.length;
  }
  deleteOperations = insurancePlans.map((insurancePlan) => ({
    method: 'DELETE',
    url: `/InsurancePlan/${insurancePlan.id}`,
  }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${insurancePlans.length} InsurancePlans`);

  //   delete all z3 buckets in the project
  console.log('Deleting all z3 buckets...');
  const buckets = await oystehr.z3.listBuckets();
  for (const bucket of buckets) {
    await oystehr.z3.deleteBucket({ bucketName: bucket.name });
  }
  console.log(`deleted ${buckets.length} z3 buckets`);

  //    delete all Group FHIR resources in the project
  console.log('Deleting all Groups...');
  const groups = (
    await oystehr.fhir.search<Group>({
      resourceType: 'Group',
    })
  ).unbundle();
  deleteOperations = groups.map((group) => ({ method: 'DELETE', url: `/Group/${group.id}` }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${groups.length} Groups`);

  // delete all PractitionerRole FHIR resources in the project
  console.log('Deleting all PractitionerRoles...');
  const practitionerRoles = (
    await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
    })
  ).unbundle();
  deleteOperations = practitionerRoles.map((practitionerRole) => ({
    method: 'DELETE',
    url: `/PractitionerRole/${practitionerRole.id}`,
  }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${practitionerRoles.length} PractitionerRoles`);

  //   delete all HealthcareService FHIR resources in the project
  console.log('Deleting all HealthcareServices...');
  const healthcareServices = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
    })
  ).unbundle();
  deleteOperations = healthcareServices.map((healthcareService) => ({
    method: 'DELETE',
    url: `/HealthcareService/${healthcareService.id}`,
  }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${healthcareServices.length} HealthcareServices`);

  // delete all users in the project
  console.log('Deleting all users...');
  const users = await oystehr.user.list();
  for (const user of users) {
    await oystehr.user.delete({ id: user.id });
  }
  console.log(`deleted ${users.length} users`);

  // delete all Organization FHIR resources in the project
  console.log('Deleting all Organizations...');
  currentIndex = 0;
  total = 1;
  const organizations: Organization[] = [];
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
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    organizations.push(...unbundled);
    currentIndex += unbundled.length;
  }
  deleteOperations = organizations.map((organization) => ({
    method: 'DELETE',
    url: `/Organization/${organization.id}`,
  }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${organizations.length} Organizations`);

  // delete all applications in the project
  console.log('Deleting all applications...');
  const applications = await oystehr.application.list();
  deleteOperations = applications.map((application) => ({ method: 'DELETE', url: `/Application/${application.id}` }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${applications.length} applications`);

  // delete all m2m clients in the project
  console.log('Deleting all M2M clients...');
  const m2mClients = await oystehr.m2m.list();
  deleteOperations = m2mClients.map((m2mClient) => ({ method: 'DELETE', url: `/M2M/${m2mClient.id}` }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${m2mClients.length} M2M clients`);

  // delete all roles in the project
  console.log('Deleting all IAM roles...');
  const iamRoles = await oystehr.role.list();
  deleteOperations = iamRoles.map((iamRole) => ({ method: 'DELETE', url: `/Role/${iamRole.id}` }));
  await oystehr.fhir.transaction({ requests: deleteOperations });
  console.log(`deleted ${iamRoles.length} IAM roles`);
}

main().catch((e) => console.error(e));
