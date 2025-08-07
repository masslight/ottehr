import fs from 'fs';
import { CONFIG } from '../lib/configuration';

const writeInfraSpec = (): void => {
  const sendgridConfig = Object.values(CONFIG.sendgrid.templates || {})
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

  const stringifiedConfig = JSON.stringify(sendgridConfig, null, 2);
  fs.mkdirSync('.ottehr_config/iac-inputs', { recursive: true });
  fs.writeFileSync('.ottehr_config/iac-inputs/sendgrid.json', stringifiedConfig, 'utf8');
};

writeInfraSpec();
