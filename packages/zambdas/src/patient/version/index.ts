import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { configSentry, topLevelCatch, ZambdaInput } from '../../shared';

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('version', input.secrets);
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: version }),
    };
  } catch (error: any) {
    return topLevelCatch('version', error, input.secrets, true);
  }
});
