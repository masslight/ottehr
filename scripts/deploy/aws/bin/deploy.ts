#!/usr/bin/env node
import { CloudFrontClient, ListDistributionsCommand, ListDistributionsCommandOutput } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';
import * as cdk from 'aws-cdk-lib';
import config from '../../deploy-config.json';
import { OttehrDataStack } from '../lib/ottehr-data-stack';
import { OttehrInfraStack } from '../lib/ottehr-infra-stack';

const app = new cdk.App();
const projectConfig: any = config;
const environment = projectConfig.environment;
const stackPrefix = projectConfig.stack_prefix ?? 'ottehr';
const awsProfile = projectConfig.aws_profile ?? 'ottehr';

void (async () => {
  try {
    await setupDeploy();
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
})();

async function setupDeploy(): Promise<void> {
  const infra = new OttehrInfraStack(app, `${stackPrefix}-infra-stack-${environment}`);
  new OttehrDataStack(app, `${stackPrefix}-data-stack-${environment}`, {
    patientPortalBucket: infra.patientPortalBucket,
    ehrBucket: infra.ehrBucket,
    patientPortalDistribution: infra.patientPortalDistribution,
    ehrDistribution: infra.ehrDistribution,
  });
}

export async function getCloudFrontDistributions(): Promise<ListDistributionsCommandOutput> {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: fromIni({ profile: awsProfile }) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}
