import fs from 'fs';
import path from 'path';

export interface StatementTemplatePayload {
  template: string;
  fileName: string;
  logoBase64: string;
}

function getLogo(): string {
  const logoPath = path.resolve(process.cwd(), 'assets', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${logoBuffer.toString('base64')}`;
}

function getStatementTemplateByExtension(template: string, extension: 'html' | 'json'): StatementTemplatePayload {
  const templateFileName = template.endsWith(`.${extension}`) ? template : `${template}.${extension}`;
  const templatePath = path.resolve(process.cwd(), 'assets', 'statements', templateFileName);
  const statementTemplate = fs.readFileSync(templatePath, 'utf8');
  const logoBase64 = getLogo();

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
