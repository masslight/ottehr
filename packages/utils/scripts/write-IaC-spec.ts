import fs from 'fs';
import { BRANDING_CONFIG, SENDGRID_CONFIG } from '../lib/configuration';

const writeInfraSpec = (): void => {
  const templates = Object.values(SENDGRID_CONFIG.templates || {})
    .filter(Boolean)
    .reduce(
      (acc, entry) => {
        if (entry && entry.templateName) {
          const { templateName, ...rest } = entry;
          acc[templateName] = rest;
        }
        return acc;
      },
      {} as Record<string, any>
    );
  const { projectName } = BRANDING_CONFIG;
  if (!projectName) {
    throw new Error('Project name is not defined');
  }
  const tfModel = {
    projectName,
    templates,
  };
  const stringifiedConfig = JSON.stringify(tfModel, null, 2);
  fs.mkdirSync('../../config/sendgrid', { recursive: true });
  fs.writeFileSync('../../config/sendgrid/sendgrid.json', stringifiedConfig, 'utf8');
};

writeInfraSpec();
