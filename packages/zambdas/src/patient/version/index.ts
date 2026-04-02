import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { wrapHandler, ZambdaInput } from '../../shared';

export const index = wrapHandler('get-version', async (_input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ version: version }),
  };
});
