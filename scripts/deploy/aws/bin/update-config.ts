#!/usr/bin/env node
import config from '../../deploy-config.json';
import { CloudFrontClient, ListDistributionsCommand, ListDistributionsCommandOutput } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';
import { updateEnvFiles, updateZapehr } from '../../helpers';
import Oystehr from '@oystehr/sdk';

const projectConfig: any = config;
const environment = projectConfig.environment;
const projectId = projectConfig.project_id;
const accessToken = projectConfig.access_token;

void (async () => {
  try {
    const distributions = await getCloudFrontDistributions();
    const patientPortalDistribution = distributions.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-patientPortal-${projectId}`
    );
    const ehrDistribution = distributions.DistributionList?.Items?.find(
      (distribution: any) => distribution.Comment === `ottehr-ehr-${projectId}`
    );
    if (patientPortalDistribution && ehrDistribution) {
      const patientPortalUrl = `https://${patientPortalDistribution.DomainName}`;
      const ehrUrl = `https://${ehrDistribution.DomainName}`;
      const oystehr = new Oystehr({
        accessToken,
        projectId,
      });
      await updateEnvFiles(environment, patientPortalUrl, ehrUrl);
      await updateZapehr(oystehr, patientPortalUrl, ehrUrl);
    }
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
})();

export async function getCloudFrontDistributions(): Promise<ListDistributionsCommandOutput> {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: fromIni({ profile: 'ottehr' }) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}
