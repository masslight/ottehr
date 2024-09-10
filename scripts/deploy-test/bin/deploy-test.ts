#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import { updateZambdas } from '../lib/deploy-test-stack';
import * as cdk from 'aws-cdk-lib';
import config from "../config.json";
import { DeployTestStack } from '../lib/deploy-test-stack';
import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';
import process from 'child_process';

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
  console.log(1);
  // process.execSync(`cd ../../packages/telemed-intake/app && npm run build:${environment}`, { stdio: 'inherit' })
  console.log(2);
  process.execSync(`cd ../../packages/telemed-ehr/app && npm run build:${environment}`, { stdio: 'inherit' })

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