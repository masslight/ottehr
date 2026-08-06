import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../shared/types/common';
import { wrapHandler } from '../../shared/sentry';

export const index = wrapHandler('failing-endpoint', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  throw new Error('Test zambda error');
});
