import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../../shared/types/common';
import { getHTMLStatementTemplate } from '../../../shared/statements/get-statement-template';
import { wrapHandler } from '../../../shared/sentry';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler(
  'get-statement-template',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const validatedInput = validateRequestParameters(input);
    const { template } = validatedInput;
    const templateDetails = getHTMLStatementTemplate(template);

    return {
      statusCode: 200,
      body: JSON.stringify(templateDetails),
    };
  }
);
