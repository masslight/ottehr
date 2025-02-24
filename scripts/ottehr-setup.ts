import { input, password } from '@inquirer/prompts';
import Oystehr, { M2m, M2mRotateSecretResponse } from '@oystehr/sdk';
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

  const accessToken = await password({
    message: 'Please enter your access token:',
    validate: (input: any) => !!input || 'Access token is required',
  });
  const projectId = await input({
    message: 'Please enter your project id:',
    validate: (input: any) => !!input || 'Project id is required',
  });
  const providerEmail = await input({
    message: 'Please enter the email of your first provider:',
    validate: (input: any) => !!input || 'Provider email is required',
  });
  return { accessToken, projectId, providerEmail };
}

async function createM2M(
  oystehr: Oystehr,
  projectId: string
): Promise<{ deviceId: string; clientId: string; secret: string }> {
  let m2m: M2m;
  try {
    m2m = await oystehr.m2m.create({
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
          {
            action: ['RCM:CheckInsuranceEligibility'],
            effect: 'Allow',
            resource: ['RCM:InsuranceEligibility'],
          },
        ],
      },
    });
  } catch (err) {
    console.error('error', err);
    throw new Error(`Failed to create M2M client. Status: ${(err as Oystehr.OystehrSdkError).code}`);
  }

  let secretData: M2mRotateSecretResponse;
  try {
    secretData = await oystehr.m2m.rotateSecret({ id: m2m.id });
  } catch (err) {
    throw new Error(`Failed to rotate M2M secret. Status: ${(err as Oystehr.OystehrSdkError).code}`);
  }

  return { deviceId: m2m.profile.replace('Device/', ''), clientId: m2m.clientId, secret: secretData.secret! };
}

async function runCLI(): Promise<void> {
  let userInput: { accessToken: string; projectId: string; providerEmail: string };
  try {
    userInput = await getUserInput();
  } catch (err) {
    console.error('Setup canceled');
    process.exit(1);
  }
  let environment = 'local';
  if (process.argv.length >= 6) {
    environment = process.argv[5];
  }

  console.log('Starting setup...');

  const oystehr = new Oystehr({
    accessToken: userInput.accessToken,
    projectId: userInput.projectId,
    services: {
      fhirApiUrl: 'https://fhir-api.zapehr.com',
      projectApiUrl,
    },
  });
  const { clientId: m2mClientId, secret: m2mSecret } = await createM2M(oystehr, userInput.projectId);
  console.log('Created m2m:', m2mClientId);

  try {
    await setupEHR(oystehr, userInput.projectId, userInput.providerEmail, m2mClientId, m2mSecret, environment);
    await setupIntake(oystehr, userInput.projectId, m2mClientId, m2mSecret, environment);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

runCLI().catch(() => process.exit(1));
