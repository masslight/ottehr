import config from '../deploy-config.json';
import { updateZapehr, updateZambdas } from '../helpers';

const projectConfig: any = config;
const environment = projectConfig.environment;
const projectID = projectConfig.project_id;
const intakeDomain = projectConfig.intake_domain;
const ehrDomain = projectConfig.ehr_domain;

async function deploy(): Promise<void> {
  const intake = `https://${intakeDomain}`;
  const ehr = `https://${ehrDomain}`;
  await updateZapehr(intake, ehr);
  await updateZambdas(environment, intake, ehr);
}

deploy().catch((error) => console.error(error));
