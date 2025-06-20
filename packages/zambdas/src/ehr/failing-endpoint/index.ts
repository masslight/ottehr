import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { captureSentryException, topLevelCatch, ZambdaInput } from '../../shared';

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    throw new Error('Test zambda error');
  } catch (error) {
    await topLevelCatch('failing-endpoint', error, input.secrets, captureSentryException);
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Test zambda error' }),
      statusCode: 500,
    };
  }
});
