#!/usr/bin/env node
import { CloudFrontClient, ListDistributionsCommand, ListDistributionsCommandOutput } from '@aws-sdk/client-cloudfront';
import { fromIni } from '@aws-sdk/credential-providers';
import Oystehr from '@oystehr/sdk';
import config from '../../deploy-config.json';
import { getM2MClientAccessToken, updateEnvFiles, updateOystehr } from '../../helpers';

const projectConfig: any = config;
const environment = projectConfig.environment;
const projectId = projectConfig.project_id;
const accessTokenFromConfig = projectConfig.access_token;
const clientId = projectConfig.client_id;
const clientSecret = projectConfig.client_secret;
const awsProfile = projectConfig.aws_profile ?? 'ottehr';

const args = process.argv.slice(2);
const noUpdateEnvFilesArg = args.includes('--no-update-env-files');
const noUpdateAppsArg = args.includes('--no-update-apps');

void (async () => {
  if (noUpdateEnvFilesArg && noUpdateAppsArg) {
    console.error('Nothing to do, exiting');
    process.exit(0);
  }
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
      const accessToken = accessTokenFromConfig ?? (await getM2MClientAccessToken(clientId, clientSecret));
      const oystehr = new Oystehr({
        accessToken,
        projectId,
      });
      if (!noUpdateEnvFilesArg) {
        await updateEnvFiles(environment, patientPortalUrl, ehrUrl);
      }
      if (!noUpdateAppsArg) {
        await updateOystehr(oystehr, patientPortalUrl, ehrUrl);
      }
    }
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
})();

export async function getCloudFrontDistributions(): Promise<ListDistributionsCommandOutput> {
  const cloudfrontClient = new CloudFrontClient({ region: 'us-east-1', credentials: getCredentials(awsProfile) });
  return await cloudfrontClient.send(new ListDistributionsCommand({}));
}

function getCredentials(profile: string): any {
  if (process.env.CI) {
    console.warn('Running in CI, using default credentials');
    return undefined; // Use default credentials in CI
  }
  let ini;
  try {
    ini = fromIni({ profile });
  } catch (error) {
    console.error(`Error loading AWS profile "${profile}":`, error);
    process.exit(1);
  }
  return ini;
}
