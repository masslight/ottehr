import { APIGatewayProxyResult } from 'aws-lambda';
import fs from 'fs';
import path from 'path';
import { getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

function getLogo(): string {
  const logoPath = path.resolve(process.cwd(), 'assets', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${logoBuffer.toString('base64')}`;
}

export const index = wrapHandler(
  'get-statement-template',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);
      const { template } = validatedInput;

      const templateFileName = template.endsWith('.html') ? template : `${template}.html`;
      const templatePath = path.resolve(process.cwd(), 'assets', 'statements', templateFileName);
      const htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      const logoBase64 = getLogo();

      return {
        statusCode: 200,
        body: JSON.stringify({
          template: htmlTemplate,
          fileName: templateFileName,
          logoBase64,
        }),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('get-statement-template', error, ENVIRONMENT);
    }
  }
);
