import inquirer from 'inquirer';
import Oystehr from '@oystehr/sdk';
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
  for (const med of medications) {
    if (med.id) {
      await oystehr.fhir.delete({ resourceType: 'Medication', id: med.id });
    }
  }
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
  for (const plan of insurancePlans) {
    if (plan.id) {
      await oystehr.fhir.delete({ resourceType: 'InsurancePlan', id: plan.id });
    }
  }
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
  for (const group of groups) {
    if (group.id) {
      await oystehr.fhir.delete({ resourceType: 'Group', id: group.id });
    }
  }
  console.log(`deleted ${groups.length} Groups`);

  // delete all PractitionerRole FHIR resources in the project
  console.log('Deleting all PractitionerRoles...');
  const practitionerRoles = (
    await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
    })
  ).unbundle();
  for (const role of practitionerRoles) {
    if (role.id) {
      await oystehr.fhir.delete({ resourceType: 'PractitionerRole', id: role.id });
    }
  }
  console.log(`deleted ${practitionerRoles.length} PractitionerRoles`);

  //   delete all HealthcareService FHIR resources in the project
  console.log('Deleting all HealthcareServices...');
  const healthcareServices = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
    })
  ).unbundle();
  for (const service of healthcareServices) {
    if (service.id) {
      await oystehr.fhir.delete({ resourceType: 'HealthcareService', id: service.id });
    }
  }
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
  for (const org of organizations) {
    if (org.id) {
      await oystehr.fhir.delete({ resourceType: 'Organization', id: org.id });
    }
  }
  console.log(`deleted ${organizations.length} Organizations`);

  // delete all applications in the project
  console.log('Deleting all applications...');
  const applications = await oystehr.application.list();
  for (const app of applications) {
    await oystehr.application.delete({ id: app.id });
  }
  console.log(`deleted ${applications.length} applications`);

  // delete all m2m clients in the project
  console.log('Deleting all M2M clients...');
  const m2mClients = await oystehr.m2m.list();
  for (const client of m2mClients) {
    await oystehr.m2m.delete({ id: client.id });
  }
  console.log(`deleted ${m2mClients.length} M2M clients`);

  // delete all roles in the project
  console.log('Deleting all IAM roles...');
  const iamRoles = await oystehr.role.list();
  for (const role of iamRoles) {
    await oystehr.role.delete({ roleId: role.id });
  }
  console.log(`deleted ${iamRoles.length} IAM roles`);

  //   delete all zambdas in the account
  console.log('Deleting all Zambdas...');
  const zambdas = await oystehr.zambda.list();
  for (const zambda of zambdas) {
    await oystehr.zambda.delete({ id: zambda.id });
  }
  console.log(`deleted ${zambdas.length} Zambdas`);
}

main().catch((e) => console.error(e));
