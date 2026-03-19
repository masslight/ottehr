import fs from 'fs';
import path from 'path';
import { getLogoBase64 } from './get-logo-base64';

export interface StatementTemplatePayload {
  template: string;
  fileName: string;
  logoBase64: string;
}

function getStatementTemplateByExtension(template: string, extension: 'html' | 'json'): StatementTemplatePayload {
  const templateFileName = template.endsWith(`.${extension}`) ? template : `${template}.${extension}`;
  const templatePath = path.resolve(process.cwd(), 'assets', 'statements', templateFileName);
  const statementTemplate = fs.readFileSync(templatePath, 'utf8');
  const logoBase64 = getLogoBase64();

  return {
    template: statementTemplate,
    fileName: templateFileName,
    logoBase64,
  };
}

export function getHTMLStatementTemplate(template: string): StatementTemplatePayload {
  return getStatementTemplateByExtension(template, 'html');
}

export function getJSONStatementTemplate(template: string): StatementTemplatePayload {
  return getStatementTemplateByExtension(template, 'json');
}
