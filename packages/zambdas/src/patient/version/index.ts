import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

export const index = wrapHandler('get-version', async (_input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ version: version }),
  };
});
