import Oystehr from '@oystehr/sdk';
import config from '../deploy-config.json';
import { updateEnvFiles, updateZapehr } from '../helpers';

const projectConfig: any = config;
const environment = projectConfig.environment;
const intakeDomain = projectConfig.intake_domain;
const ehrDomain = projectConfig.ehr_domain;
const projectId = projectConfig.project_id;
const accessToken = projectConfig.access_token;

async function deploy(): Promise<void> {
  const intake = `https://${intakeDomain}`;
  const ehr = `https://${ehrDomain}`;
  const oystehr = new Oystehr({
    accessToken,
    projectId,
  });
  await updateZapehr(oystehr, intake, ehr);
  await updateEnvFiles(environment, intake, ehr);
}

deploy().catch((error) => console.error(error));
