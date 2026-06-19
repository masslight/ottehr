import { APIGatewayProxyResult } from 'aws-lambda';
import { wrapHandler, ZambdaInput } from '../../shared';
import { handler } from './handler';

export const index = wrapHandler(
  'create-billing-claim-from-encounter',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    return handler(input);
  }
);
