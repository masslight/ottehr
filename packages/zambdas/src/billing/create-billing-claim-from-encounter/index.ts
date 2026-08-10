import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { handler } from './handler';

export const index = wrapHandler(
  'create-billing-claim-from-encounter',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    return handler(input);
  }
);
