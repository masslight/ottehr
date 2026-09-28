import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

export const index = wrapHandler('failing-endpoint', async (_input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  throw new Error('Test zambda error');
});
