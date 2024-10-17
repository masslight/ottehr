#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import config from "../config.json";
import { DeployTestStack } from '../lib/deploy-test-stack';
import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';

const app = new cdk.App();
const projectConfig: any = config;
const environment = projectConfig.environment;
const projectID = projectConfig.project_id;
const accessToken = projectConfig.access_token;
setupDeploy();
async function setupDeploy() {
  await deploy();
  await updateZapehr();
}

async function deploy() {
  await updateZambdas(environment, projectID, accessToken);
  new DeployTestStack(app, 'DeployTestStack', {
    /* If you don't specify 'env', this stack will be environment-agnostic.
    * Account/Region-dependent features and context lookups will not work,
    * but a single synthesized template can be deployed anywhere. */

    /* Uncomment the next line to specialize this stack for the AWS Account
    * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

    /* Uncomment the next line if you know exactly what Account and Region you
    * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },

    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  });
}

export async function getCloudFrontDistributions() {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: fromIni({ profile: 'ottehr' }) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}

async function updateZapehr() {
  const distributionsRequest = await getCloudFrontDistributions();
  const intakeDistribution = `https://${distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-intake')?.DomainName}`;
  const ehrDistribution = `https://${distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-ehr')?.DomainName}`;
  const applicationsRequest = await fetch('https://project-api.zapehr.com/v1/application', {
    headers: {
      'x-zapehr-project-id': projectID,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const applications = await applicationsRequest.json();
  
  const envIntakeFile = fs.readFileSync(`../../packages/telemed-intake/app/env/.env.${environment}`, 'utf8');
  const applicationIntakeClientID = envIntakeFile.split('\n').find((item) => item.split('=')[0] === 'VITE_APP_CLIENT_ID')?.split('=')[1];
  const applicationIntakeID = applications.find((application: any) => application.clientId === applicationIntakeClientID).id;
  const envEHRFile = fs.readFileSync(`../../packages/telemed-ehr/app/env/.env.${environment}`, 'utf8');
  const applicationEHRClientID = envEHRFile.split('\n').find((item) => item.split('=')[0] === 'VITE_APP_ZAPEHR_APPLICATION_CLIENT_ID')?.split('=')[1];
  const applicationEHRID = applications.find((application: any) => application.clientId === applicationEHRClientID).id;

  const updateIntakeApplicationRequest = await fetch(`https://project-api.zapehr.com/v1/application/${applicationIntakeID}`, {
    method: 'PATCH',
    headers: {
      'x-zapehr-project-id': projectID,
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      loginRedirectUri: intakeDistribution,
      allowedCallbackUrls: [intakeDistribution],
      allowedLogoutUrls: [intakeDistribution],
      allowedCORSOriginsUrls: [intakeDistribution],
      allowedWebOriginsUrls: [intakeDistribution]
    }),
  });
  const updateEHRApplicationRequest = await fetch(`https://project-api.zapehr.com/v1/application/${applicationEHRID}`, {
    method: 'PATCH',
    headers: {
      'x-zapehr-project-id': projectID,
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      loginRedirectUri: ehrDistribution,
      allowedCallbackUrls: [ehrDistribution],
      allowedLogoutUrls: [ehrDistribution],
      allowedCORSOriginsUrls: [ehrDistribution],
      allowedWebOriginsUrls: [ehrDistribution]
    }),
  });
  console.log(await updateIntakeApplicationRequest.json())
  console.log(await updateEHRApplicationRequest.json())
}

export async function updateZambdas(environment: string, projectID: string, accessToken: string) {
  const zambdasRequest = await fetch('https://project-api.zapehr.com/v1/zambda', {
    headers: {
      'x-zapehr-project-id': projectID,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const zambdas = await zambdasRequest.json();
  let intakeEnvFile = fs.readFileSync(`../../packages/telemed-intake/app/env/.env.${environment}`, 'utf8');
  let ehrEnvFile = fs.readFileSync(`../../packages/telemed-ehr/app/env/.env.${environment}`, 'utf8');
  intakeEnvFile = intakeEnvFile.replace(/paperwork\//g, '');
  intakeEnvFile = intakeEnvFile.replace("http://localhost:3000/local", "https://project-api.zapehr.com/v1");
  ehrEnvFile = ehrEnvFile.replace("http://localhost:3000/local", "https://project-api.zapehr.com/v1");
  ehrEnvFile = ehrEnvFile.replace("http://localhost:4000/local", "https://project-api.zapehr.com/v1");
  intakeEnvFile = intakeEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  ehrEnvFile = ehrEnvFile.replace('VITE_APP_IS_LOCAL=true', 'VITE_APP_IS_LOCAL=false');
  const distributionsRequest = await getCloudFrontDistributions();
  const intakeDistribution = distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-intake');
  const ehrDistribution = distributionsRequest.DistributionList?.Items?.find((distribution) => distribution.Comment === 'ottehr-ehr');
  if (intakeDistribution) {
    ehrEnvFile = ehrEnvFile.replace('VITE_APP_QRS_URL=http://localhost:3002', `VITE_APP_QRS_URL=${`https://${intakeDistribution.DomainName}`}`);
  }
  if (ehrDistribution) {
    ehrEnvFile = ehrEnvFile.replace('VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL=http://localhost:4002', `VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL=https://${ehrDistribution.DomainName}`)
  }
  zambdas.forEach((zambda: any) => {
    // remove prefix from zambda name
    let zambdaName = zambda.name.split('-').slice(1).join('-');
    if (zambda.name.startsWith('telemed-')) {
      intakeEnvFile = intakeEnvFile.replace(zambdaName, zambda.id);
    } else if (zambda.name.startsWith('admin-')) {
      ehrEnvFile = ehrEnvFile.replace(zambdaName, zambda.id);
    }

    if (zambda.name === 'telemed-create-appointment') {
      ehrEnvFile = ehrEnvFile.replace('create-appointment', zambda.id);
    }
    if (zambda.name === 'telemed-check-in') {
      ehrEnvFile = ehrEnvFile.replace('check-in', zambda.id);
    }
  });
  fs.writeFileSync(`../../packages/telemed-intake/app/env/.env.${environment}`, intakeEnvFile);
  fs.writeFileSync(`../../packages/telemed-ehr/app/env/.env.${environment}`, ehrEnvFile);
}
