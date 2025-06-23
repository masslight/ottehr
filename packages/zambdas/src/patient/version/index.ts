import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { configSentry, topLevelCatch, ZambdaInput } from '../../shared';
import { getSecret, SecretsKeys } from 'utils';

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('version', input.secrets);
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: version }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('version', error, ENVIRONMENT);
  }
});
