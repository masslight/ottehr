#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CloudFrontClient, ListDistributionsCommand, ListDistributionsCommandOutput } from '@aws-sdk/client-cloudfront';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { fromIni } from '@aws-sdk/credential-providers';
import * as cdk from 'aws-cdk-lib';
import config from '../../deploy-config.json';
import { OttehrDataStack } from '../lib/ottehr-data-stack';
import { OttehrInfraStack } from '../lib/ottehr-infra-stack';

const app = new cdk.App();
const projectConfig: any = config;
const environment = projectConfig.environment;
const stackPrefix = projectConfig.stack_prefix ?? 'ottehr';

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
