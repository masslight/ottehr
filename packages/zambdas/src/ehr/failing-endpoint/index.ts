import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { configSentry, topLevelCatch, ZambdaInput } from '../../shared';

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  configSentry('failing-endpoint', input.secrets);
  try {
    throw new Error('Test zambda error');
  } catch (error) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('failing-endpoint', error, ENVIRONMENT);
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Test zambda error' }),
      statusCode: 500,
    };
  }
});
