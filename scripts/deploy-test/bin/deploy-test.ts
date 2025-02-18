#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import config from '../deploy-config.json';
import { DeployTestStack } from '../lib/deploy-test-stack';
import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';
import { updateZambdas, updateZapehr } from '../helpers';

const app = new cdk.App();
const projectConfig: any = config;
const environment = projectConfig.environment;
const projectID = projectConfig.project_id;

void (async () => {
  try {
    await setupDeploy();
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
})();

async function setupDeploy(): Promise<void> {
  await deploy();
  const distributionsRequest = await getCloudFrontDistributions();
  const intakeDistribution = `https://${
    distributionsRequest.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-intake-${projectID}`
    )?.DomainName
  }`;
  const ehrDistribution = `https://${
    distributionsRequest.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-ehr-${projectID}`
    )?.DomainName
  }`;
  await updateZapehr(intakeDistribution, ehrDistribution);
}

async function deploy(): Promise<void> {
  const distributionsRequest = await getCloudFrontDistributions();
  const intakeDistribution = `https://${
    distributionsRequest.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-intake-${projectID}`
    )?.DomainName
  }`;
  const ehrDistribution = `https://${
    distributionsRequest.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-ehr-${projectID}`
    )?.DomainName
  }`;
  await updateZambdas(environment, intakeDistribution, ehrDistribution);
  new DeployTestStack(app, `DeployTestStack-${environment}`, {
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

export async function getCloudFrontDistributions(): Promise<any> {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: fromIni({ profile: 'ottehr' }) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}
