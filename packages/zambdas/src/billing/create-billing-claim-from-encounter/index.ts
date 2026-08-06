import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../shared/types/common';
import { wrapHandler } from '../../shared/sentry';
import { handler } from './handler';

export const index = wrapHandler(
  'create-billing-claim-from-encounter',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    return handler(input);
  }
);
