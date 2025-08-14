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
const stackSuffix = projectConfig.stack_suffix ? `-${projectConfig.stack_suffix}` : '';
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
  const infra = new OttehrInfraStack(app, `ottehr-infra-stack-${environment}${stackSuffix}`);
  new OttehrDataStack(app, `ottehr-data-stack-${environment}${stackSuffix}`, {
    patientPortalBucket: infra.patientPortalBucket,
    ehrBucket: infra.ehrBucket,
  });
}

export async function getCloudFrontDistributions(): Promise<ListDistributionsCommandOutput> {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: fromIni({ profile: awsProfile }) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}
