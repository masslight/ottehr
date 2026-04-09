import { APIGatewayProxyResult } from 'aws-lambda';
import { getHTMLStatementTemplate, wrapHandler, ZambdaInput } from '../../../shared';
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
