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

export function getStatementTemplate(template: string): StatementTemplatePayload {
  const templateFileName = template.endsWith('.html') ? template : `${template}.html`;
  const templatePath = path.resolve(process.cwd(), 'assets', 'statements', templateFileName);
  const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
  const logoBase64 = getLogo();

  return {
    template: htmlTemplate,
    fileName: templateFileName,
    logoBase64,
  };
}
