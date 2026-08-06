import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { ZambdaInput } from '../../shared/types/common';
import { wrapHandler } from '../../shared/sentry';

export const index = wrapHandler('get-version', async (_input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ version: version }),
  };
});
